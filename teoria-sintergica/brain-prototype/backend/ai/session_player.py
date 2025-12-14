"""
Session Player: Reproduce sesiones EEG completas cronológicamente.

Permite "revivir" estudios de meditación/concentración desde inicio a fin,
observando la evolución temporal de coherencia y estados mentales.
"""

import mne
import numpy as np
from typing import Optional, Dict, List
import os


class SessionPlayer:
    """
    Reproductor de sesiones EEG longitudinales.
    
    Características:
    - Carga archivos EDF completos (sin segmentar)
    - Navegación temporal (play/pause/seek)
    - Extrae ventanas deslizantes para análisis
    - Mantiene metadata de la sesión (protocolo, timestamps)
    """
    
    def __init__(self, session_path: str = None, window_duration: float = 2.0):
        """
        Args:
            session_path: Ruta a archivo EDF (si None, usa PhysioNet)
            window_duration: Duración de ventana de análisis en segundos
        """
        self.window_duration = window_duration
        self.current_position = 0.0  # Posición actual en segundos
        self.is_playing = False
        self.playback_speed = 1.0  # 1.0 = tiempo real
        
        # Estado de la sesión
        self.raw: Optional[mne.io.Raw] = None
        self.session_metadata: Dict = {}
        self.total_duration: float = 0.0
        self.fs: int = 160  # Se actualizará al cargar datos
        
        if session_path:
            self.load_session(session_path)
        else:
            # Intentar cargar sesión de meditación real
            success = self.load_meditation_session()
            if not success:
                # Fallback: sesión por defecto de PhysioNet
                print("📼 Falling back to default PhysioNet session...")
                self.load_default_session()
    
    def load_default_session(self):
        """
        Carga sesión por defecto de PhysioNet (Motor Imagery Run completo).
        """
        print("📼 Loading default session from PhysioNet...")
        
        from mne.datasets import eegbci
        
        # Cargar Run 2 completo (Eyes Closed - Resting State)
        # Es una sesión de ~1 minuto de EEG continuo
        data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
        os.makedirs(data_path, exist_ok=True)
        mne.set_config('MNE_DATASETS_EEGBCI_PATH', data_path, set_env=True)
        
        # Subject 1, Run 2 (Eyes Closed Baseline)
        raw_fnames = eegbci.load_data(subjects=[1], runs=[2], path=data_path, update_path=False)
        self.raw = mne.io.read_raw_edf(raw_fnames[0], preload=True, verbose=False)
        
        # Preprocesamiento estándar
        eegbci.standardize(self.raw)
        self.raw.pick_types(eeg=True, exclude='bads')
        self.raw.filter(1., 50., fir_design='firwin', verbose=False)
        
        # Metadata
        self.fs = int(self.raw.info['sfreq'])
        self.total_duration = self.raw.times[-1]
        self.session_metadata = {
            'name': 'PhysioNet Motor Imagery - Run 2 (Eyes Closed)',
            'subject': 'S001',
            'protocol': 'Resting State - Eyes Closed',
            'duration': self.total_duration,
            'channels': self.raw.info['nchan'],
            'sampling_rate': self.fs
        }
        
        print(f"✓ Session loaded: {self.session_metadata['name']}")
        print(f"  Duration: {self.total_duration:.1f}s ({self.total_duration/60:.1f}m)")
        print(f"  Channels: {self.session_metadata['channels']}")
        print(f"  Sampling Rate: {self.fs} Hz")
    
    def load_meditation_session(self):
        """
        Carga sesión de meditación real desde OpenNeuro dataset ds003969.
        
        Dataset descargado:
        - Subject 001, task-med1breath (breathing meditation)
        - Duration: ~10 minutes
        - 79 EEG channels @ 1024 Hz
        
        Descarga manual:
        1. cd backend && source venv/bin/activate
        2. datalad install https://github.com/OpenNeuroDatasets/ds003969.git
        3. cd ds003969 && datalad get sub-001/eeg/sub-001_task-med1breath_eeg.bdf
        4. Convertir a EDF (ver DATASETS-GUIDE.md)
        """
        edf_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), 
            'data', 
            'meditation', 
            'sub-001_meditation.edf'
        )
        
        if not os.path.exists(edf_path):
            print(f"⚠ Meditation session not found: {edf_path}")
            print("Download dataset from OpenNeuro and convert to EDF.")
            print("See: backend/DATASETS-GUIDE.md for instructions")
            return False
        
        print(f"📼 Loading meditation session: {edf_path}")
        self.raw = mne.io.read_raw_edf(edf_path, preload=True, verbose=False)
        
        # Metadata
        self.fs = int(self.raw.info['sfreq'])
        self.total_duration = self.raw.times[-1]
        self.session_metadata = {
            'name': 'OpenNeuro ds003969 - Subject 001 Meditation',
            'subject': 'S001',
            'protocol': 'Breathing-focused meditation (10 minutes)',
            'duration': self.total_duration,
            'channels': self.raw.info['nchan'],
            'sampling_rate': self.fs,
            'dataset': 'OpenNeuro ds003969'
        }
        
        print(f"✓ Meditation session loaded: {self.total_duration:.1f}s ({self.total_duration/60:.1f}m)")
        print(f"  Channels: {self.session_metadata['channels']}")
        print(f"  Sampling Rate: {self.fs} Hz")
        
        return True
    
    def load_physionet_extended(self):
        """
        Carga múltiples runs de PhysioNet concatenados para sesión más larga.
        
        Concatena runs 6, 10, 14 (Motor Imagery) = ~3 minutos total.
        """
        print("📼 Loading extended PhysioNet session...")
        
        from mne.datasets import eegbci
        import mne
        
        data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
        os.makedirs(data_path, exist_ok=True)
        mne.set_config('MNE_DATASETS_EEGBCI_PATH', data_path, set_env=True)
        
        # Cargar múltiples runs
        raw_fnames = eegbci.load_data(subjects=[1], runs=[6, 10, 14], path=data_path, update_path=False)
        raw_files = [mne.io.read_raw_edf(f, preload=True, verbose=False) for f in raw_fnames]
        
        # Concatenar
        self.raw = mne.concatenate_raws(raw_files)
        
        # Preprocesamiento
        eegbci.standardize(self.raw)
        self.raw.pick_types(eeg=True, exclude='bads')
        self.raw.filter(1., 50., fir_design='firwin', verbose=False)
        
        # Metadata
        self.fs = int(self.raw.info['sfreq'])
        self.total_duration = self.raw.times[-1]
        self.session_metadata = {
            'name': 'PhysioNet Motor Imagery - Runs 6,10,14 (Extended)',
            'subject': 'S001',
            'protocol': 'Motor Imagery Tasks (hands/feet) - 3 minutes',
            'duration': self.total_duration,
            'channels': self.raw.info['nchan'],
            'sampling_rate': self.fs
        }
        
        print(f"✓ Extended session loaded: {self.total_duration:.1f}s ({self.total_duration/60:.1f}m)")
        return True
    
    def load_session(self, edf_path: str):
        """
        Carga sesión desde archivo EDF personalizado.
        """
        if not os.path.exists(edf_path):
            raise FileNotFoundError(f"Session file not found: {edf_path}")
        
        print(f"📼 Loading custom session: {edf_path}")
        self.raw = mne.io.read_raw_edf(edf_path, preload=True, verbose=False)
        
        # Preprocesamiento básico
        self.raw.pick_types(eeg=True, exclude='bads')
        self.raw.filter(1., 50., fir_design='firwin', verbose=False)
        
        # Metadata
        self.fs = int(self.raw.info['sfreq'])
        self.total_duration = self.raw.times[-1]
        self.session_metadata = {
            'name': os.path.basename(edf_path),
            'duration': self.total_duration,
            'channels': self.raw.info['nchan'],
            'sampling_rate': self.fs
        }
        
        print(f"✓ Custom session loaded: {self.total_duration:.1f}s")
    
    def get_window_at(self, position_seconds: float) -> Optional[np.ndarray]:
        """
        Extrae ventana de EEG en posición temporal específica.
        
        Args:
            position_seconds: Posición en la sesión (segundos)
            
        Returns:
            Array (n_channels, n_timepoints) o None si fuera de rango
        """
        if self.raw is None:
            return None
        
        # Validar rango
        if position_seconds < 0 or position_seconds > self.total_duration - self.window_duration:
            return None
        
        # Convertir tiempo a samples
        start_sample = int(position_seconds * self.fs)
        end_sample = int((position_seconds + self.window_duration) * self.fs)
        
        # Extraer datos
        data, _ = self.raw[:, start_sample:end_sample]
        
        return data
    
    def next_window(self) -> Optional[Dict]:
        """
        Obtiene siguiente ventana en reproducción secuencial.
        
        Returns:
            Dict con datos EEG y metadata, o None si llegó al final o está pausado
        """
        if self.raw is None:
            return None
        
        # Si está pausado, retornar la ventana actual sin avanzar
        if not self.is_playing:
            window_data = self.get_window_at(self.current_position)
            if window_data is None:
                return None
            
            return {
                'data': window_data,
                'timestamp': self.current_position,
                'duration': self.window_duration,
                'progress': self.current_position / self.total_duration,
                'fs': self.fs,
                'session_name': self.session_metadata.get('name', 'Unknown'),
                'paused': True
            }
        
        # Si llegamos al final, reiniciar
        if self.current_position >= self.total_duration - self.window_duration:
            print("🔄 Session finished. Restarting from beginning.")
            self.current_position = 0.0
        
        # Obtener ventana actual
        window_data = self.get_window_at(self.current_position)
        
        if window_data is None:
            return None
        
        # Preparar output
        result = {
            'data': window_data,
            'timestamp': self.current_position,
            'duration': self.window_duration,
            'progress': self.current_position / self.total_duration,
            'fs': self.fs,
            'session_name': self.session_metadata.get('name', 'Unknown'),
            'paused': False
        }
        
        # Avanzar posición (considerando playback speed)
        # Por defecto avanzamos 0.2s por frame (5Hz streaming)
        self.current_position += 0.2 * self.playback_speed
        
        return result
    
    def seek(self, position_seconds: float):
        """
        Salta a posición específica en la sesión.
        """
        if 0 <= position_seconds <= self.total_duration:
            self.current_position = position_seconds
            print(f"⏩ Seeked to {position_seconds:.1f}s ({position_seconds/60:.1f}m)")
        else:
            print(f"⚠ Position {position_seconds}s out of range [0, {self.total_duration}]")
    
    def play(self):
        """Inicia reproducción."""
        self.is_playing = True
        print("▶️  Playing session...")
    
    def pause(self):
        """Pausa reproducción."""
        self.is_playing = False
        print("⏸  Session paused")
    
    def restart(self):
        """Reinicia desde el inicio."""
        self.current_position = 0.0
        print("⏮  Session restarted")
    
    def set_speed(self, speed: float):
        """
        Ajusta velocidad de reproducción.
        
        Args:
            speed: 0.5 = mitad, 1.0 = tiempo real, 2.0 = doble velocidad
        """
        self.playback_speed = max(0.1, min(5.0, speed))
        print(f"⏩ Playback speed: {self.playback_speed}x")
    
    def get_status(self) -> Dict:
        """
        Retorna estado actual del reproductor.
        """
        return {
            'is_playing': self.is_playing,
            'current_position': self.current_position,
            'total_duration': self.total_duration,
            'progress_percent': (self.current_position / self.total_duration * 100) if self.total_duration > 0 else 0,
            'playback_speed': self.playback_speed,
            'session_metadata': self.session_metadata
        }
    
    def get_timeline_markers(self) -> List[Dict]:
        """
        [FUTURO] Retorna marcadores de eventos en la sesión.
        
        Útil para protocolos estructurados:
        - "0:00 - Baseline Start"
        - "5:00 - Meditation Start"
        - "25:00 - Meditation End"
        """
        # Por ahora, solo marcadores básicos
        markers = [
            {'time': 0.0, 'label': 'Session Start', 'type': 'start'},
            {'time': self.total_duration, 'label': 'Session End', 'type': 'end'}
        ]
        
        # Si la sesión es > 10min, agregar marcadores cada minuto
        if self.total_duration > 600:
            for minute in range(1, int(self.total_duration // 60)):
                markers.append({
                    'time': minute * 60.0,
                    'label': f'{minute}min',
                    'type': 'marker'
                })
        
        return sorted(markers, key=lambda x: x['time'])
