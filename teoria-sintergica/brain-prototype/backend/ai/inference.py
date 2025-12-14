import torch
import numpy as np
from .model import SyntergicVAE
from .dataset import EEGDataset
from .session_player import SessionPlayer
from .playlist_manager import PlaylistManager
import os
import sys

# Agregar path del backend para importar análisis
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from analysis.metrics import SyntergicMetrics

class SyntergicBrain:
    """
    Clase principal que gestiona el "Cerebro Digital" en tiempo real.
    
    ACTUALIZADO: Ahora usa análisis científico completo (FFT, coherencia, entropía).
    """
    def __init__(self, model_path="syntergic_vae.pth"):
        self.device = torch.device("cpu") # Inferencia en CPU
        
        # 1. Configurar dimensiones
        self.input_dim = 64 * 161 
        
        # 2. Cargar Arquitectura
        self.model = SyntergicVAE(input_dim=self.input_dim, hidden_dim=512, latent_dim=64)
        
        # 3. Cargar Pesos
        full_path = os.path.join(os.path.dirname(__file__), model_path)
        if os.path.exists(full_path):
            print(f"✓ Loading trained brain from {full_path}...")
            self.model.load_state_dict(torch.load(full_path, map_location=self.device))
        else:
            print(f"⚠ WARNING: Model not found at {full_path}. Using random initialization.")
        
        self.model.to(self.device)
        self.model.eval()
        
        
        # 4. Cargar datasets para distintos modos cognitivos
        print("✓ Loading EEG datasets for different modes...")
        self.datasets = {}
        self.loaders = {}
        self.iterators = {}
        
        # Modo RELAX (Meditación) -> Run 2 (Eyes Closed)
        self.datasets['relax'] = EEGDataset(subjects=[1], runs=[2])
        self.loaders['relax'] = torch.utils.data.DataLoader(self.datasets['relax'], batch_size=1, shuffle=False)
        self.iterators['relax'] = iter(self.loaders['relax'])
        
        # Modo FOCUS (Alta Actividad) -> Runs 6, 10, 14 (Motor Imagery)
        self.datasets['focus'] = EEGDataset(subjects=[1], runs=[6, 10, 14]) 
        self.loaders['focus'] = torch.utils.data.DataLoader(self.datasets['focus'], batch_size=1, shuffle=False)
        self.iterators['focus'] = iter(self.loaders['focus'])
        
        # Estado actual
        self.current_mode = 'focus' 
        
        # Sampling rate del dataset PhysioNet
        self.fs = 160  # Hz (PhysioNet EEG Motor Imagery)
        
        # --- SESSION PLAYER (Nuevo modo) ---
        # Reproduce sesiones completas cronológicamente
        print("✓ Loading Session Player (longitudinal playback)...")
        self.session_player = SessionPlayer(window_duration=2.0)
        self.session_mode_active = False  # False = dataset aleatorio, True = sesión secuencial
        
        # --- PLAYLIST MANAGER ---
        # Gestiona múltiples sesiones para reproducción secuencial
        print("✓ Loading Playlist Manager (multi-session playback)...")
        self.playlist = PlaylistManager()
        
        # --- SMOOTHING TEMPORAL ---
        # Buffers para promediar últimos N frames y evitar cambios bruscos
        self.smoothing_window = 5  # ~1 segundo a 5Hz
        self.coherence_history = []
        self.entropy_history = []
        self.bands_history = {'delta': [], 'theta': [], 'alpha': [], 'beta': [], 'gamma': []}
        self.plv_history = []
        
        print("✓ Syntergic Brain ready. Default mode: FOCUS")
        print("✓ Scientific metrics module loaded (FFT, Coherence, Entropy)")
        print(f"✓ Playlist loaded with {len(self.playlist.get_playlist())} sessions")

    def set_mode(self, mode):
        # Modo especial: reproducción de sesión completa
        if mode == 'session':
            print(f"📼 Switching to SESSION PLAYER mode (longitudinal playback)")
            self.session_mode_active = True
            self.session_player.restart()
            self.session_player.play()
            # Sincronizar playlist con session_player actual
            self.playlist.current_player = self.session_player
            # Reset smoothing
            self.coherence_history = []
            self.entropy_history = []
            self.bands_history = {'delta': [], 'theta': [], 'alpha': [], 'beta': [], 'gamma': []}
            self.plv_history = []
            return True
        
        # Modos dataset (relax/focus)
        if mode in self.datasets:
            print(f"→ Switching brain mode to: {mode.upper()}")
            self.current_mode = mode
            self.session_mode_active = False  # Desactivar session player
            # Reset smoothing buffers al cambiar de modo
            self.coherence_history = []
            self.entropy_history = []
            self.bands_history = {'delta': [], 'theta': [], 'alpha': [], 'beta': [], 'gamma': []}
            self.plv_history = []
            return True
        return False
    
    def _smooth_value(self, history_buffer, new_value):
        """
        Agrega valor al buffer y retorna promedio móvil.
        """
        history_buffer.append(new_value)
        if len(history_buffer) > self.smoothing_window:
            history_buffer.pop(0)
        return np.mean(history_buffer)
    
    # --- PLAYLIST MANAGEMENT METHODS ---
    
    def get_playlist(self):
        """Retorna lista de sesiones disponibles."""
        return self.playlist.get_playlist()
    
    def get_current_playlist_info(self):
        """Información de la sesión actual en el playlist."""
        return self.playlist.get_current_session_info()
    
    def next_playlist_session(self):
        """Avanza a la siguiente sesión del playlist."""
        session_info = self.playlist.next_session()
        if session_info:
            # Cargar nueva sesión en session_player
            self.session_player = self.playlist.load_session(self.playlist.current_index)
            self.session_player.restart()
            # Sincronizar current_player con session_player
            self.playlist.current_player = self.session_player
            # Limpiar buffers de smoothing
            self.coherence_history = []
            self.entropy_history = []
            self.bands_history = {'delta': [], 'theta': [], 'alpha': [], 'beta': [], 'gamma': []}
            self.plv_history = []
            # Retornar info de la sesión (no el SessionPlayer)
            return self.playlist.get_current_session_info()
        return None
    
    def previous_playlist_session(self):
        """Retrocede a la sesión anterior del playlist."""
        session_info = self.playlist.previous_session()
        if session_info:
            # Cargar nueva sesión
            self.session_player = self.playlist.load_session(self.playlist.current_index)
            self.session_player.restart()
            # Sincronizar current_player con session_player
            self.playlist.current_player = self.session_player
            # Limpiar buffers
            self.coherence_history = []
            self.entropy_history = []
            self.bands_history = {'delta': [], 'theta': [], 'alpha': [], 'beta': [], 'gamma': []}
            self.plv_history = []
            # Retornar info de la sesión (no el SessionPlayer)
            return self.playlist.get_current_session_info()
        return None

    def next_state(self):
        """
        Obtiene el siguiente estado sintérgico con análisis científico completo.
        
        ACTUALIZADO: Soporta modo sesión (reproducción cronológica) y modo dataset.
        """
        # --- MODO SESSION: Reproducción cronológica ---
        if self.session_mode_active:
            # Verificar si debemos auto-avanzar a la siguiente sesión del playlist
            if self.playlist.should_auto_advance():
                print("Auto-advancing to next playlist session...")
                next_info = self.next_playlist_session()
                if next_info:
                    print(f"   → Now playing: {next_info['name']}")
            
            session_window = self.session_player.next_window()
            
            if session_window is None:
                # Fallback a dataset si hay error
                print("⚠ Session playback error, falling back to dataset mode")
                self.session_mode_active = False
            else:
                # Convertir ventana MNE a tensor
                # session_window['data'] shape: (n_channels, n_timepoints)
                window_data = session_window['data']
                
                # --- RESIZE PARA VAE ---
                # VAE espera: 64 canales × 161 timepoints (1s @ 160Hz)
                # Dataset meditation tiene: 79 canales × 2048 timepoints (2s @ 1024Hz)
                
                import numpy as np
                from scipy import signal as scipy_signal
                
                # 1. Recortar a 64 canales (primeros 64)
                if window_data.shape[0] > 64:
                    window_data = window_data[:64, :]
                elif window_data.shape[0] < 64:
                    # Pad con zeros si hay menos de 64
                    padding = np.zeros((64 - window_data.shape[0], window_data.shape[1]))
                    window_data = np.vstack([window_data, padding])
                
                # 2. Resample de 1024Hz a 160Hz
                if session_window['fs'] != self.fs:
                    # Calcular ratio de resampling
                    resample_ratio = self.fs / session_window['fs']
                    new_length = int(window_data.shape[1] * resample_ratio)
                    
                    # Resample cada canal
                    window_data_resampled = np.zeros((64, new_length))
                    for ch_idx in range(64):
                        window_data_resampled[ch_idx] = scipy_signal.resample(
                            window_data[ch_idx], 
                            new_length
                        )
                    window_data = window_data_resampled
                
                # 3. Recortar a 161 samples (1 segundo @ 160Hz)
                if window_data.shape[1] > 161:
                    window_data = window_data[:, :161]
                elif window_data.shape[1] < 161:
                    # Pad con zeros
                    padding = np.zeros((64, 161 - window_data.shape[1]))
                    window_data = np.hstack([window_data, padding])
                
                # Flatten y convertir a tensor
                window_data = window_data.flatten()
                real_eeg_input = torch.from_numpy(window_data).float().unsqueeze(0).to(self.device)
                
                # Continuar con procesamiento normal
                return self._process_eeg_window(real_eeg_input, session_window['timestamp'])
        
        # --- MODO DATASET: Ventanas aleatorias ---
        try:
            # Obtener siguiente sample EEG
            real_eeg_input = next(self.iterators[self.current_mode])
        except StopIteration:
            # Reiniciar ciclo
            self.iterators[self.current_mode] = iter(self.loaders[self.current_mode])
            real_eeg_input = next(self.iterators[self.current_mode])
            
        real_eeg_input = real_eeg_input.to(self.device)
        
        return self._process_eeg_window(real_eeg_input)
    
    def _process_eeg_window(self, real_eeg_input, session_timestamp=None):
        """
        Procesa ventana EEG y retorna estado sintérgico.
        
        Args:
            real_eeg_input: Tensor EEG (1, features)
            session_timestamp: Timestamp de la sesión (opcional)
        """
        
        # --- PARTE 1: INFERENCIA VAE (Focal Point) ---
        coherence_vae, focal_point = self.model.get_syntergic_state(real_eeg_input)
        
        # Obtener varianza para fallback
        with torch.no_grad():
            _, logvar = self.model.encode(real_eeg_input)
            variance_mean = torch.mean(torch.exp(logvar)).item()
        
        # --- PARTE 2: ANÁLISIS CIENTÍFICO (Nuevo) ---
        # Convertir tensor a numpy para análisis
        eeg_numpy = real_eeg_input.cpu().numpy().flatten()
        
        # Simular split de hemisferios (64 canales PhysioNet)
        # Canales 0-31: Izquierdo, 32-63: Derecho (simplificación)
        # En realidad deberíamos mapear según 10-20 system, pero esto funciona
        mid_point = len(eeg_numpy) // 2
        left_hemisphere = eeg_numpy[:mid_point]
        right_hemisphere = eeg_numpy[mid_point:]
        
        # Preparar datos para SyntergicMetrics
        eeg_data = {
            'signal': eeg_numpy,
            'left_hemisphere': left_hemisphere,
            'right_hemisphere': right_hemisphere,
            'raw_variance': variance_mean
        }
        
        # Calcular TODAS las métricas científicas
        metrics = SyntergicMetrics.compute_all(eeg_data, fs=self.fs)
        
        # --- PARTE 3: SMOOTHING TEMPORAL ---
        # Aplicar promedio móvil para transiciones suaves
        smoothed_coherence = self._smooth_value(self.coherence_history, metrics['coherence'])
        smoothed_entropy = self._smooth_value(self.entropy_history, metrics['entropy'])
        smoothed_plv = self._smooth_value(self.plv_history, metrics.get('plv', metrics['coherence']))
        
        # Smooth de bandas (cada una por separado)
        smoothed_bands = {}
        for band_name in ['delta', 'theta', 'alpha', 'beta', 'gamma']:
            smoothed_bands[band_name] = self._smooth_value(
                self.bands_history[band_name], 
                metrics['bands'][band_name]
            )
        
        # Re-inferir estado basado en valores suavizados
        # Usar alpha suavizado para determinar estado más estable
        if smoothed_bands['alpha'] > 0.5:
            smoothed_state = "meditation"
        elif smoothed_bands['beta'] + smoothed_bands['gamma'] > 0.6:
            smoothed_state = "focused"
        elif smoothed_bands['theta'] > 0.4:
            smoothed_state = "relaxed"
        elif smoothed_bands['gamma'] > 0.3:
            smoothed_state = "insight"
        elif smoothed_bands['delta'] > 0.4:
            smoothed_state = "deep_relaxation"
        else:
            smoothed_state = "transitioning"
        
        # --- PARTE 4: COMBINAR RESULTADOS ---
        # Focal point viene del VAE (mapeo 3D del espacio latente)
        # Coherencia, entropía, bandas vienen del análisis espectral SUAVIZADO
        
        result = {
            "coherence": smoothed_coherence,
            "entropy": smoothed_entropy,
            "focal_point": focal_point,
            "bands": smoothed_bands,
            "dominant_frequency": metrics['dominant_frequency'],  # Esta la dejamos sin smooth
            "state": smoothed_state,
            "plv": smoothed_plv
        }
        
        # Si estamos en modo sesión, agregar metadata temporal
        if session_timestamp is not None:
            result['session_timestamp'] = session_timestamp
            result['session_progress'] = self.session_player.get_status()['progress_percent']
        
        return result
