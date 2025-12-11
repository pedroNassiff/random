import torch
import numpy as np
from .model import SyntergicVAE
from .dataset import EEGDataset
import os

class SyntergicBrain:
    """
    Clase principal que gestiona el "Cerebro Digital" en tiempo real.
    Carga el modelo entrenado y provee estados sucesivos al servidor WebSocket.
    """
    def __init__(self, model_path="syntergic_vae.pth"):
        self.device = torch.device("cpu") # Inferencia en CPU es suficiente y más segura para websockets
        
        # 1. Configurar dimensiones (coincidentes con el entrenamiento)
        # 64 canales * 161 timepoints (según lo que vimos en el log de entrenamiento)
        self.input_dim = 64 * 161 
        
        # 2. Cargar Arquitectura
        self.model = SyntergicVAE(input_dim=self.input_dim, hidden_dim=512, latent_dim=64)
        
        # 3. Cargar Pesos
        full_path = os.path.join(os.path.dirname(__file__), model_path)
        if os.path.exists(full_path):
            print(f"Loading trained brain from {full_path}...")
            self.model.load_state_dict(torch.load(full_path, map_location=self.device))
        else:
            print(f"WARNING: Model not found at {full_path}. Using random initialization.")
        
        self.model.to(self.device)
        self.model.eval()
        
        
        # 4. Cargar datasets para distintos modos cognitivos
        print("Loading EEG datasets for different modes...")
        self.datasets = {}
        self.loaders = {}
        self.iterators = {}
        
        # Modo RELAX (Base/Meditación) -> Run 2 (Eyes Closed)
        self.datasets['relax'] = EEGDataset(subjects=[1], runs=[2])
        self.loaders['relax'] = torch.utils.data.DataLoader(self.datasets['relax'], batch_size=1, shuffle=True)
        self.iterators['relax'] = iter(self.loaders['relax'])
        
        # Modo FOCUS (Alta Actividad) -> Runs 6, 10, 14 (Motor Imagery)
        self.datasets['focus'] = EEGDataset(subjects=[1], runs=[6, 10, 14]) 
        self.loaders['focus'] = torch.utils.data.DataLoader(self.datasets['focus'], batch_size=1, shuffle=True)
        self.iterators['focus'] = iter(self.loaders['focus'])
        
        # Estado actual
        self.current_mode = 'focus' 
        print("Brain ready. Default mode: FOCUS")

    def set_mode(self, mode):
        if mode in self.datasets:
            print(f"Switching brain mode to: {mode}")
            self.current_mode = mode
            return True
        return False

    def next_state(self):
        """
        Obtiene el siguiente estado sintérgico basado en el modo actual.
        """
        try:
            # Obtener siguiente "pensamiento" del iterador activo
            real_eeg_input = next(self.iterators[self.current_mode])
        except StopIteration:
            # Reiniciar ciclo cuando se acaben los datos
            self.iterators[self.current_mode] = iter(self.loaders[self.current_mode])
            real_eeg_input = next(self.iterators[self.current_mode])
            
        real_eeg_input = real_eeg_input.to(self.device)
        
        # Inferencia: El VAE "percibe" este pensamiento y calcula su estructura
        coherence, focal_point = self.model.get_syntergic_state(real_eeg_input)
        
        # Retornamos dict listo para la API
        return {
            "coherence": coherence,
            "focal_point": focal_point,
            "entropy": 1.0 - coherence # Simplificación teórica
        }
