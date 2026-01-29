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
        
        # Control de tiempo real para evitar avance múltiple por WebSockets paralelos
        self._last_advance_time = None  # Timestamp de última llamada
        self._last_returned_position = -1.0  # Última posición retornada
        
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
    
    def load_recorded_session(self, session_id: int):
        """
        Carga sesión grabada desde la base de datos SQLite.
        
        Las sesiones grabadas tienen datos de 4 canales del Muse 2:
        TP9, AF7, AF8, TP10 @ 256 Hz
        
        Args:
            session_id: ID de la sesión en la base de datos
        """
        from database import get_database
        
        print(f"📼 Loading recorded session #{session_id} from database...")
        
        db = get_database()
        
        # Obtener metadata
        session_meta = db.get_session(session_id)
        if session_meta is None:
            raise ValueError(f"Session {session_id} not found in database")
        
        # Obtener todos los samples EEG (numpy array: timestamp, tp9, af7, af8, tp10, aux)
        samples = db.get_eeg_samples(session_id)
        if samples.size == 0:
            raise ValueError(f"No EEG samples found for session {session_id}")
        
        # samples es array de shape (n_samples, 6): [timestamp, tp9, af7, af8, tp10, aux]
        timestamps = samples[:, 0]
        eeg_data = samples[:, 1:5].T  # Shape: (4, n_samples) - tp9, af7, af8, tp10
        
        # Calcular sampling rate real
        if len(timestamps) > 1:
            self.fs = int(1.0 / np.median(np.diff(timestamps)))
            # Clamp to reasonable range
            if self.fs < 50:
                self.fs = 256
            elif self.fs > 1000:
                self.fs = 256
        else:
            self.fs = 256  # Default Muse sampling rate
        
        # Crear objeto Raw de MNE para compatibilidad
        ch_names = ['TP9', 'AF7', 'AF8', 'TP10']
        ch_types = ['eeg'] * 4
        info = mne.create_info(ch_names=ch_names, sfreq=self.fs, ch_types=ch_types)
        self.raw = mne.io.RawArray(eeg_data, info, verbose=False)
        
        # Filtrar ligeramente
        self.raw.filter(1., 50., fir_design='firwin', verbose=False)
        
        # Metadata
        self.total_duration = timestamps[-1] if len(timestamps) > 0 else 0
        self.session_metadata = {
            'name': session_meta.name if hasattr(session_meta, 'name') else f'Recorded Session #{session_id}',
            'subject': 'User',
            'protocol': 'Muse 2 Recording',
            'duration': self.total_duration,
            'channels': 4,
            'sampling_rate': self.fs,
            'device': 'Muse 2',
            'notes': session_meta.notes if hasattr(session_meta, 'notes') else '',
            'db_id': session_id,
            'start_time': session_meta.start_time if hasattr(session_meta, 'start_time') else ''
        }
        
        # Cargar eventos/marcadores
        events = db.get_events(session_id)
        self._recorded_events = events
        
        print(f"✓ Recorded session loaded: {self.total_duration:.1f}s")
        print(f"  Samples: {len(timestamps)}")
        print(f"  Events: {len(events)}")
        print(f"  Sampling Rate: {self.fs} Hz")
        
        return True

    def load_recorded_session_v2(self, recording_id: int):
        """
        Carga sesión grabada desde PostgreSQL + InfluxDB (nueva arquitectura).
        
        Las sesiones grabadas tienen datos de 4 canales del Muse 2:
        TP9, AF7, AF8, TP10 @ 256 Hz
        
        Args:
            recording_id: ID de la grabación en PostgreSQL (eeg_recordings)
        """
        from database import get_postgres_client_sync, get_influx_client
        
        print(f"📼 Loading recorded session #{recording_id} from PostgreSQL + InfluxDB...")
        
        # Obtener metadata desde PostgreSQL
        postgres = get_postgres_client_sync()
        postgres.connect()
        recording = postgres.get_recording(recording_id)
        
        if recording is None:
            raise ValueError(f"Recording {recording_id} not found in PostgreSQL")
        
        # Obtener samples desde InfluxDB
        influx = get_influx_client()
        influx.connect()
        samples = influx.get_samples(recording_id, limit=500000)  # Max 500k samples
        
        if not samples:
            raise ValueError(f"No EEG samples found for recording {recording_id} in InfluxDB")
        
        # Convertir a arrays numpy
        n_samples = len(samples)
        timestamps = np.array([s['timestamp'] for s in samples])
        eeg_data = np.array([
            [s['tp9'] for s in samples],
            [s['af7'] for s in samples],
            [s['af8'] for s in samples],
            [s['tp10'] for s in samples]
        ])  # Shape: (4, n_samples)
        
        # Normalizar timestamps (relativos al inicio)
        if len(timestamps) > 0:
            timestamps = timestamps - timestamps[0]
        
        # Calcular sampling rate real
        if len(timestamps) > 1:
            diffs = np.diff(timestamps)
            diffs = diffs[diffs > 0]  # Filtrar valores inválidos
            if len(diffs) > 0:
                self.fs = int(1.0 / np.median(diffs))
                # Clamp to reasonable range
                if self.fs < 50 or self.fs > 1000:
                    self.fs = 256
            else:
                self.fs = 256
        else:
            self.fs = recording.sampling_rate or 256
        
        # Crear objeto Raw de MNE para compatibilidad
        ch_names = ['TP9', 'AF7', 'AF8', 'TP10']
        ch_types = ['eeg'] * 4
        info = mne.create_info(ch_names=ch_names, sfreq=self.fs, ch_types=ch_types)
        self.raw = mne.io.RawArray(eeg_data, info, verbose=False)
        
        # Filtrar ligeramente
        self.raw.filter(1., 50., fir_design='firwin', verbose=False)
        
        # Metadata
        self.total_duration = timestamps[-1] if len(timestamps) > 0 else recording.duration_seconds
        self.session_metadata = {
            'name': recording.name or f'Recording #{recording_id}',
            'subject': 'User',
            'protocol': 'Muse 2 Recording',
            'duration': self.total_duration,
            'channels': 4,
            'sampling_rate': self.fs,
            'device': recording.device or 'Muse 2',
            'notes': recording.notes or '',
            'db_id': recording_id,
            'start_time': recording.started_at.isoformat() if recording.started_at else '',
            'avg_alpha': recording.avg_alpha,
            'avg_coherence': recording.avg_coherence
        }
        
        # Cargar métricas pre-calculadas y calcular tiempos relativos
        try:
            raw_metrics = influx.get_metrics(recording_id)
            
            # Calcular tiempo relativo para cada métrica
            if raw_metrics:
                # Ordenar por timestamp
                raw_metrics.sort(key=lambda x: x['timestamp'])
                
                # El primer timestamp es el inicio
                start_timestamp = raw_metrics[0]['timestamp']
                
                # Añadir relative_time a cada métrica
                for i, metric in enumerate(raw_metrics):
                    metric['relative_time'] = metric['timestamp'] - start_timestamp
                    metric['index'] = i
                
                self._recorded_metrics = raw_metrics
                print(f"  Metrics loaded with relative times: {len(raw_metrics)}")
            else:
                self._recorded_metrics = []
        except Exception as e:
            print(f"  Warning: Could not load metrics: {e}")
            self._recorded_metrics = []
        
        print(f"✓ Recorded session v2 loaded: {self.total_duration:.1f}s")
        print(f"  Samples: {n_samples}")
        print(f"  Metrics: {len(self._recorded_metrics) if hasattr(self, '_recorded_metrics') else 0}")
        print(f"  Sampling Rate: {self.fs} Hz")
        
        return True

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
    
    def _get_metrics_at_position(self, position_seconds: float) -> Optional[Dict]:
        """
        Busca las métricas pregrabadas más cercanas a la posición actual.
        
        Args:
            position_seconds: Posición en segundos desde el inicio
            
        Returns:
            Dict con métricas o None si no hay métricas disponibles
        """
        if not hasattr(self, '_recorded_metrics') or not self._recorded_metrics:
            return None
        
        # Buscar la métrica más cercana a la posición actual
        # Las métricas se guardan cada ~0.2s
        best_metric = None
        min_diff = float('inf')
        
        for metric in self._recorded_metrics:
            # Usar relative_time que calculamos al cargar
            metric_time = metric.get('relative_time')
            
            # Si no tiene relative_time (sesiones antiguas), usar index
            if metric_time is None:
                if 'index' in metric:
                    metric_time = metric['index'] * 0.2  # Aprox 0.2s por métrica
                else:
                    continue
            
            diff = abs(metric_time - position_seconds)
            if diff < min_diff:
                min_diff = diff
                best_metric = metric
        
        # Si la diferencia es mayor a 1 segundo, no usar
        if min_diff > 1.0:
            return None
            
        return best_metric

    def next_window(self) -> Optional[Dict]:
        """
        Obtiene siguiente ventana en reproducción secuencial.
        
        IMPORTANTE: Usa tiempo real del sistema para avanzar, así múltiples
        conexiones WebSocket no aceleran la reproducción.
        
        Returns:
            Dict con datos EEG y metadata, o None si llegó al final o está pausado
        """
        import time
        
        if self.raw is None:
            return None
        
        current_time = time.time()
        
        # Si está pausado, retornar la ventana actual sin avanzar
        if not self.is_playing:
            self._last_advance_time = None  # Reset al pausar
            window_data = self.get_window_at(self.current_position)
            if window_data is None:
                return None
            
            # Buscar métricas pregrabadas
            recorded_metrics = self._get_metrics_at_position(self.current_position)
            
            return {
                'data': window_data,
                'timestamp': self.current_position,
                'duration': self.window_duration,
                'progress': self.current_position / self.total_duration,
                'fs': self.fs,
                'session_name': self.session_metadata.get('name', 'Unknown'),
                'paused': True,
                'recorded_metrics': recorded_metrics
            }
        
        # --- AVANCE BASADO EN TIEMPO REAL ---
        # Calcular cuánto tiempo real ha pasado desde la última llamada
        if self._last_advance_time is not None:
            elapsed_real_time = current_time - self._last_advance_time
            # Avanzar en la sesión proporcional al tiempo real
            # (multiplicado por playback_speed)
            advance_amount = elapsed_real_time * self.playback_speed
            self.current_position += advance_amount
        
        self._last_advance_time = current_time
        
        # Si llegamos al final, reiniciar
        if self.current_position >= self.total_duration - self.window_duration:
            print("🔄 Session finished. Restarting from beginning.")
            self.current_position = 0.0
            self._last_advance_time = current_time  # Reset timer
        
        # Obtener ventana actual
        window_data = self.get_window_at(self.current_position)
        
        if window_data is None:
            return None
        
        # Buscar métricas pregrabadas para esta posición
        recorded_metrics = self._get_metrics_at_position(self.current_position)
        
        # Preparar output
        result = {
            'data': window_data,
            'timestamp': self.current_position,
            'duration': self.window_duration,
            'progress': self.current_position / self.total_duration,
            'fs': self.fs,
            'session_name': self.session_metadata.get('name', 'Unknown'),
            'paused': False,
            'recorded_metrics': recorded_metrics
        }
        
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
        import time
        self.is_playing = True
        self._last_advance_time = time.time()  # Iniciar timer
        print("▶️  Playing session...")
    
    def pause(self):
        """Pausa reproducción."""
        self.is_playing = False
        self._last_advance_time = None  # Detener timer
        print("⏸  Session paused")
    
    def restart(self):
        """Reinicia desde el inicio."""
        import time
        self.current_position = 0.0
        self._last_advance_time = time.time() if self.is_playing else None
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
