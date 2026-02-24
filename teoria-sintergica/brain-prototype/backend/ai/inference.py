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
from analysis.spectral import SpectralAnalyzer
from analysis.coherence import CoherenceAnalyzer

# Type hints para hardware (evitar import circular)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from hardware import MuseConnector

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
        
        # --- MUSE 2 HARDWARE MODE ---
        # Referencia al conector Muse (se asigna cuando se activa modo 'muse')
        self.muse_connector = None
        self.muse_mode_active = False
        
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
        print("✓ Muse 2 hardware mode available (use set_mode('muse', muse_connector))")

    def set_mode(self, mode, muse_connector=None):
        # Modo especial: MUSE 2 HARDWARE (EEG en vivo)
        if mode == 'muse':
            if muse_connector is None:
                print("❌ Muse connector not provided")
                return False
            if not muse_connector.is_streaming:
                print("❌ Muse not streaming. Start stream first.")
                return False
            
            print(f"🎧 Switching to MUSE 2 LIVE MODE (real-time EEG)")
            self.muse_connector = muse_connector
            self.muse_mode_active = True
            self.session_mode_active = False
            self.current_mode = 'muse'
            # Reset smoothing
            self.coherence_history = []
            self.entropy_history = []
            self.bands_history = {'delta': [], 'theta': [], 'alpha': [], 'beta': [], 'gamma': []}
            self.plv_history = []
            return True
        
        # Modo especial: reproducción de sesión completa
        if mode == 'session':
            print(f"📼 Switching to SESSION PLAYER mode (longitudinal playback)")
            self.session_mode_active = True
            self.session_player.restart()
            self.session_player.play()
            # Sincronizar playlist con session_player actual
            self.playlist.current_player = self.session_player
            # Desactivar modo muse si estaba activo
            self.muse_mode_active = False
            self.muse_connector = None
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
            self.muse_mode_active = False  # Desactivar modo muse
            self.muse_connector = None
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
    
    def select_playlist_session(self, index: int):
        """Selecciona una sesión específica del playlist por índice."""
        if index < 0 or index >= len(self.playlist.sessions):
            return None
        
        # Cargar sesión seleccionada
        self.session_player = self.playlist.load_session(index)
        if self.session_player:
            self.session_player.restart()
            # Sincronizar current_player con session_player
            self.playlist.current_player = self.session_player
            # Limpiar buffers de smoothing
            self.coherence_history = []
            self.entropy_history = []
            self.bands_history = {'delta': [], 'theta': [], 'alpha': [], 'beta': [], 'gamma': []}
            self.plv_history = []
            return self.playlist.get_current_session_info()
        return None

    def next_state(self):
        """
        Obtiene el siguiente estado sintérgico con análisis científico completo.
        
        ACTUALIZADO: Soporta modo muse (EEG en vivo), sesión y dataset.
        """
        # --- MODO MUSE: EEG en tiempo real ---
        if self.muse_mode_active and self.muse_connector:
            return self._process_muse_window()
        
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
                # --- USAR MÉTRICAS PREGRABADAS SI ESTÁN DISPONIBLES ---
                recorded_metrics = session_window.get('recorded_metrics')
                
                if recorded_metrics:
                    # Usar métricas exactas que se grabaron
                    return self._use_recorded_metrics(recorded_metrics, session_window['timestamp'])
                
                # --- FALLBACK: Recalcular desde samples (para sesiones antiguas) ---
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
        Procesa ventana EEG de dataset PhysioNet o sesión (fallback sin métricas grabadas).

        IMPORTANTE: Solo se llama con datos ya normalizados al formato VAE:
          - 64 canales × 161 timepoints @ 160Hz, aplanados a (1, 10304)
          - Origen: DataLoader PhysioNet, o sesión antigua resampleada en next_state()
          - NO se llama desde _process_muse_window() — ese path es independiente.

        Args:
            real_eeg_input: Tensor shape (1, 10304) = 64ch × 161tp
            session_timestamp: Posición temporal en la sesión (opcional)
        """
        
        # --- PARTE 1: INFERENCIA VAE (Focal Point) ---
        coherence_vae, focal_point = self.model.get_syntergic_state(real_eeg_input)
        
        # Obtener varianza para fallback
        with torch.no_grad():
            _, logvar = self.model.encode(real_eeg_input)
            variance_mean = torch.mean(torch.exp(logvar)).item()
        
        # --- PARTE 2: ANÁLISIS CIENTÍFICO ---
        # El tensor de entrada tiene shape (1, 64*161) = (1, 10304)
        # NO aplanar todo como una sola señal: eso mezcla 64 canales
        # y da un espectro sin sentido lleno de artefactos inter-canal.
        n_channels = 64
        eeg_tensor = real_eeg_input.cpu().numpy()  # (1, 10304) o (1, n_features)
        total_features = eeg_tensor.shape[-1]
        n_timepoints = total_features // n_channels  # 161 a 160Hz
        
        if total_features == n_channels * n_timepoints:
            # Reshape correcto: (64, 161)
            eeg_2d = eeg_tensor.reshape(n_channels, n_timepoints)
        else:
            # Fallback: usar como un solo canal si la forma no encaja
            eeg_2d = eeg_tensor.reshape(1, -1)
        
        # Promediar hemisferios (canales 0-31 izq, 32-63 der según PhysioNet 10-20)
        left_hemisphere  = np.mean(eeg_2d[:n_channels//2], axis=0)   # (161,)
        right_hemisphere = np.mean(eeg_2d[n_channels//2:], axis=0)   # (161,)
        signal_main = np.mean(eeg_2d, axis=0)                        # (161,) promedio global

        eeg_data = {
            'signal': signal_main,
            'left_hemisphere': left_hemisphere,
            'right_hemisphere': right_hemisphere,
            'raw_variance': variance_mean
        }
        
        # Calcular TODAS las métricas científicas
        metrics = SyntergicMetrics.compute_all(eeg_data, fs=self.fs)

        # OVERRIDE coherencia: evitar MSC trivialmente = 1.000 o NaN
        # MSC (Welch) necesita múltiples segmentos: con 161 pts a 160Hz → 1 segmento → NaN en alpha
        # PLV (Hilbert phase) funciona bien con señales cortas → lo usamos por pares de canales
        if eeg_2d.shape[0] >= 2:
            n_half = n_channels // 2  # 32
            step = max(1, n_half // 8)  # ~8 pares para cubrir todo el scalp
            pair_plvs = []
            for i in range(0, n_half, step):
                plv = CoherenceAnalyzer.compute_phase_locking_value(
                    eeg_2d[i],          # canal izquierdo i
                    eeg_2d[i + n_half], # canal derecho simétrico
                    fs=self.fs
                )
                if np.isfinite(plv):
                    pair_plvs.append(plv)
            metrics['coherence'] = float(np.mean(pair_plvs)) if pair_plvs else metrics['coherence']
        
        # --- PARTE 3: SMOOTHING TEMPORAL ---
        # Aplicar promedio móvil para transiciones suaves
        smoothed_coherence = self._smooth_value(self.coherence_history, metrics['coherence'])
        smoothed_entropy = self._smooth_value(self.entropy_history, metrics['entropy'])
        smoothed_plv = self._smooth_value(self.plv_history, metrics.get('plv', metrics['coherence']))
        
        # Smooth de bandas (cada una por separado)
        smoothed_bands = {}
        smoothed_bands_display = {}
        for band_name in ['delta', 'theta', 'alpha', 'beta', 'gamma']:
            smoothed_bands[band_name] = self._smooth_value(
                self.bands_history[band_name], 
                metrics['bands'][band_name]
            )
            # bands_display también se suaviza (reutilizamos el mismo history)
            smoothed_bands_display[band_name] = metrics.get('bands_display', metrics['bands'])[band_name]
        
        # Re-inferir estado basado en valores suavizados
        # Thresholds calibrados con datos reales de sub-001 PhysioNet (meditación vipassana)
        # Ver SpectralAnalyzer.get_state_from_bands() para los thresholds actualizados
        smoothed_state = SpectralAnalyzer.get_state_from_bands(smoothed_bands)
        
        # --- PARTE 4: COMBINAR RESULTADOS ---
        # Focal point viene del VAE (mapeo 3D del espacio latente)
        # Coherencia, entropía, bandas vienen del análisis espectral SUAVIZADO
        
        result = {
            "coherence": smoothed_coherence,
            "entropy": smoothed_entropy,
            "focal_point": focal_point,
            "bands": smoothed_bands,
            "bands_display": smoothed_bands_display,  # 1/f corregido para la UI
            # Raw = pre-smoothing, para comparar con referencia y diagnosticar el EMA
            "bands_raw": {k: round(float(metrics['bands'][k]), 4) for k in metrics['bands']},
            "bands_display_raw": {k: round(float(metrics.get('bands_display', metrics['bands'])[k]), 4) for k in metrics['bands']},
            "dominant_frequency": metrics['dominant_frequency'],
            "state": smoothed_state,
            "state_raw": SpectralAnalyzer.get_state_from_bands(metrics['bands']),
            "plv": smoothed_plv,
            "source": "dataset",
        }
        
        # Si estamos en modo sesión, agregar metadata temporal
        if session_timestamp is not None:
            result['session_timestamp'] = session_timestamp
            result['session_progress'] = self.session_player.get_status()['progress_percent']
        
        return result

    def _use_recorded_metrics(self, recorded_metrics: dict, session_timestamp: float):
        """
        Usa métricas pregrabadas en lugar de recalcularlas.
        
        Esto permite reproducir exactamente lo que se grabó durante una sesión.
        
        Args:
            recorded_metrics: Dict con métricas guardadas en InfluxDB
            session_timestamp: Posición temporal en la sesión
            
        Returns:
            Dict con estado sintérgico usando métricas originales
        """
        # Extraer métricas guardadas
        alpha = recorded_metrics.get('alpha', 0.2)
        coherence = recorded_metrics.get('coherence', 0.5)
        entropy = recorded_metrics.get('entropy', 0.5)
        state = recorded_metrics.get('state', 'transitioning')
        
        # Bandas - pueden estar guardadas individualmente o no
        bands = {
            'delta': recorded_metrics.get('delta', 0.2),
            'theta': recorded_metrics.get('theta', 0.2),
            'alpha': alpha,
            'beta': recorded_metrics.get('beta', 0.2),
            'gamma': recorded_metrics.get('gamma', 0.2)
        }
        
        # Generar focal point sintético basado en bandas grabadas
        # (El focal point original del VAE no se guarda, así que lo reconstruimos)
        focal_point = {
            "x": (bands['alpha'] - 0.2) * 2,  # Alpha mueve hacia x positivo
            "y": (bands['theta'] - 0.2) * 2,  # Theta mueve hacia y positivo  
            "z": (bands['beta'] - 0.2) * 2    # Beta mueve hacia z positivo
        }
        
        # Normalizar focal point a rango [-1, 1]
        for key in focal_point:
            focal_point[key] = max(-1, min(1, focal_point[key]))
        
        # Corrección para display: f_centre/bandwidth (ver SpectralAnalyzer.compute_frequency_bands_display)
        # Usa f_centre/bandwidth en lugar de f^1.5 para evitar sobreboost de gamma:
        #   - Con f^1.5: gamma raw 0.007 × 252 = 1.77 → 17% visual ← incorrecto
        #   - Con f/bw:  gamma raw 0.007 × 2.0  = 0.014 → 1.6% visual ← correcto
        _centre_freqs = {'delta': 2.25, 'theta': 6.0, 'alpha': 10.5, 'beta': 21.5, 'gamma': 40.0}
        _bandwidths   = {'delta': 3.5,  'theta': 4.0, 'alpha': 5.0,  'beta': 17.0, 'gamma': 20.0}
        _corr = {k: bands[k] * (_centre_freqs[k] / _bandwidths[k]) for k in bands}
        _total = sum(_corr.values()) or 1
        bands_display = {k: v / _total for k, v in _corr.items()}

        result = {
            "coherence": coherence,
            "entropy": entropy,
            "focal_point": focal_point,
            "bands": bands,
            "bands_display": bands_display,  # 1/f corregido para la UI
            # Pre-EMA raw values (recorded metrics have no EMA smoothing applied here)
            "bands_raw": {k: round(float(bands[k]), 4) for k in bands},
            "bands_display_raw": {k: round(float(bands_display[k]), 4) for k in bands_display},
            "state_raw": SpectralAnalyzer.get_state_from_bands(bands),
            "dominant_frequency": recorded_metrics.get('dominant_frequency', 10.0),
            "state": state,
            "plv": recorded_metrics.get('plv', coherence),
            "source": "recorded",  # Indicador de que son métricas pregrabadas
            "session_timestamp": session_timestamp,
            "session_progress": self.session_player.get_status()['progress_percent']
        }
        
        return result

    def _process_muse_window(self):
        """
        Procesa datos EEG en vivo desde Muse 2.
        
        Usa análisis espectral directo (no VAE) para métricas precisas,
        ya que el VAE fue entrenado con 64 canales y Muse tiene 4.
        """
        # Importar adaptador
        from hardware import MuseToSyntergicAdapter
        
        # Obtener ventana de 2 segundos
        window = self.muse_connector.get_window(duration=2.0)
        
        if window is None:
            # No hay suficientes datos aún, retornar estado neutral
            return {
                "coherence": 0.5,
                "entropy": 0.5,
                "focal_point": {"x": 0, "y": 0, "z": 0},
                "bands": {"delta": 0.2, "theta": 0.2, "alpha": 0.2, "beta": 0.2, "gamma": 0.2},
                "dominant_frequency": 10.0,
                "state": "waiting_data",
                "plv": 0.5,
                "source": "muse2",
                "buffer_status": self.muse_connector.get_buffer_status()
            }
        
        # Preparar datos para análisis
        eeg_data = MuseToSyntergicAdapter.prepare_for_analysis(window)
        
        # Calcular métricas científicas (256 Hz del Muse)
        metrics = SyntergicMetrics.compute_all(eeg_data, fs=window.fs)
        
        # --- SMOOTHING TEMPORAL ---
        smoothed_coherence = self._smooth_value(self.coherence_history, metrics['coherence'])
        smoothed_entropy = self._smooth_value(self.entropy_history, metrics['entropy'])
        smoothed_plv = self._smooth_value(self.plv_history, metrics.get('plv', metrics['coherence']))
        
        # Smooth de bandas
        smoothed_bands = {}
        for band_name in ['delta', 'theta', 'alpha', 'beta', 'gamma']:
            smoothed_bands[band_name] = self._smooth_value(
                self.bands_history[band_name], 
                metrics['bands'][band_name]
            )
        # bands_display ya viene 1/f-corregido de SyntergicMetrics.compute_all().
        # Si no disponible (backwards compat), aplicar corrección manualmente.
        if 'bands_display' in metrics:
            smoothed_bands_display = metrics['bands_display']
        else:
            # Fallback: corrección f_centre/bandwidth (NO f^1.5, ver nota en _use_recorded_metrics)
            _centre_freqs = {'delta': 2.25, 'theta': 6.0, 'alpha': 10.5, 'beta': 21.5, 'gamma': 40.0}
            _bandwidths   = {'delta': 3.5,  'theta': 4.0, 'alpha': 5.0,  'beta': 17.0, 'gamma': 20.0}
            _corr = {k: smoothed_bands[k] * (_centre_freqs[k] / _bandwidths[k]) for k in smoothed_bands}
            _total = sum(_corr.values()) or 1
            smoothed_bands_display = {k: v / _total for k, v in _corr.items()}
        
        # Generar focal point sintético basado en bandas
        # (No usamos VAE porque fue entrenado con 64 canales)
        focal_point = MuseToSyntergicAdapter.compute_focal_point_from_bands(smoothed_bands)
        
        # Determinar estado mental (thresholds calibrados con datos reales)
        state = SpectralAnalyzer.get_state_from_bands(smoothed_bands)
        
        # Obtener calidad de señal
        signal_quality = self.muse_connector.get_signal_quality()
        avg_quality = np.mean(list(signal_quality.values())) if signal_quality else 0.5
        
        return {
            "coherence": smoothed_coherence,
            "entropy": smoothed_entropy,
            "focal_point": focal_point,
            "bands": smoothed_bands,
            "bands_display": smoothed_bands_display,  # 1/f corregido para la UI
            "bands_raw": {k: round(float(metrics['bands'][k]), 4) for k in metrics['bands']},
            "bands_display_raw": {k: round(float(metrics.get('bands_display', metrics['bands'])[k]), 4) for k in metrics['bands']},
            "dominant_frequency": metrics['dominant_frequency'],
            "state": state,
            "state_raw": SpectralAnalyzer.get_state_from_bands(metrics['bands']),
            "plv": smoothed_plv,
            "source": "muse2",
            "signal_quality": signal_quality,
            "avg_quality": avg_quality,
            "buffer_status": self.muse_connector.get_buffer_status()
        }
