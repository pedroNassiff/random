import torch
from torch.utils.data import Dataset, DataLoader
import mne
from mne.datasets import eegbci
import numpy as np
import os

class EEGDataset(Dataset):
    """
    Dataset que carga datos reales de EEG de PhysioNet (Motor Imagery).
    Sujetos imaginando mover manos/pies.
    """
    def __init__(self, subjects=[1], runs=[6, 10, 14]):
        super().__init__()
        
        print(f"Loading EEG data for subjects {subjects}...")
        
        # Guardar datos en la carpeta del proyecto para mantenerlo ordenado
        data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
        os.makedirs(data_path, exist_ok=True)
        # Configurar MNE para usar esta ruta
        mne.set_config('MNE_DATASETS_EEGBCI_PATH', data_path, set_env=True)
        
        # 1. Descargar datos (se guardan en data_path)
        # runs 6, 10, 14 son de Imaginar Movimiento (Manos vs Pies)
        raw_fnames = eegbci.load_data(subjects, runs, path=data_path, update_path=False)
        raw_files = [mne.io.read_raw_edf(f, preload=True, verbose=False) for f in raw_fnames]
        
        # 2. Concatenar todos los runs
        raw = mne.concatenate_raws(raw_files)
        
        # 3. Preprocesamiento (Estándar en neurociencia)
        # Standard 10-20 electrode layout
        eegbci.standardize(raw) 
        # Seleccionar 64 canales de EEG
        raw.pick_types(eeg=True, exclude='bads') 
        # Filtrar frecuencias relevantes (Delta a Gamma: 1-50Hz)
        raw.filter(1., 50., fir_design='firwin', verbose=False)
        
        # 4. Crear épocas (ventanas de tiempo)
        # Dividimos la señal continua en ventanas de 1 segundo
        durn = 1.0 # segundos
        events = mne.make_fixed_length_events(raw, id=1, duration=durn)
        epochs = mne.Epochs(raw, events, tmin=0, tmax=durn, baseline=None, verbose=False)
        
        # Obtener matriz de datos: (N_epochs, Channels, Time)
        self.data = epochs.get_data(copy=True)
        
        # Normalizar datos (Z-score por canal)
        # Importante para que la Neural Network aprenda bien
        self.data = (self.data - np.mean(self.data, axis=2, keepdims=True)) / np.std(self.data, axis=2, keepdims=True)
        
        # Convertir a Tensor de PyTorch y aplanar canal x tiempo para el MLP simple
        # Input shape original: (64, 160) -> 160 samples (1s a 160Hz)
        # Flatten: 64 * 160 = 10240 features
        self.n_samples = self.data.shape[0]
        self.n_channels = self.data.shape[1]
        self.n_timepoints = self.data.shape[2]
        
        print(f"Dataset created: {self.n_samples} samples of shape ({self.n_channels}, {self.n_timepoints})")

    def __len__(self):
        return self.n_samples

    def __getitem__(self, idx):
        # Retornamos vector aplanado para el VAE simple
        x = self.data[idx].flatten()
        return torch.from_numpy(x).float()

    def get_input_dim(self):
        return self.n_channels * self.n_timepoints
