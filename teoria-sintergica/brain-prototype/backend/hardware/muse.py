"""
Muse 2 EEG Headband Connector.

Conecta con Muse 2 via Lab Streaming Layer (LSL) usando muselsl.

Canales:
- TP9: Temporal izquierdo
- AF7: Frontal izquierdo  
- AF8: Frontal derecho
- TP10: Temporal derecho

Sampling rate: 256 Hz

Dependencies:
    pip install muselsl pylsl bleak
"""

import numpy as np
from collections import deque
from threading import Thread, Lock, Event
from typing import Optional, Dict, List
import time
import subprocess
import sys

from .base import (
    EEGDevice, 
    DeviceStatus, 
    DeviceInfo, 
    EEGWindow,
    SignalQualityChecker
)


class MuseConnector(EEGDevice):
    """
    Conector para Muse 2 EEG Headband.
    
    Utiliza muselsl para streaming via Lab Streaming Layer (LSL).
    
    Usage:
        muse = MuseConnector()
        devices = muse.discover()
        muse.connect(devices[0].address)
        muse.start_stream()
        
        while True:
            window = muse.get_window(duration=2.0)
            if window:
                process(window.data)
    """
    
    # Muse 2 channel mapping
    CHANNELS = ['TP9', 'AF7', 'AF8', 'TP10']
    SAMPLING_RATE = 256  # Hz
    
    # Hemispheres for coherence calculation
    LEFT_CHANNELS = [0, 1]   # TP9, AF7
    RIGHT_CHANNELS = [2, 3]  # AF8, TP10
    
    def __init__(self, buffer_duration: float = 10.0):
        """
        Args:
            buffer_duration: Duración del buffer circular en segundos
        """
        super().__init__()
        
        self._buffer_duration = buffer_duration
        self._buffer_size = int(self.SAMPLING_RATE * buffer_duration)
        
        # Buffer circular para cada canal
        self._buffer = {ch: deque(maxlen=self._buffer_size) for ch in self.CHANNELS}
        self._timestamps = deque(maxlen=self._buffer_size)
        
        # Thread de streaming
        self._stream_thread: Optional[Thread] = None
        self._stop_event = Event()
        self._buffer_lock = Lock()
        
        # Proceso de muselsl
        self._muselsl_process: Optional[subprocess.Popen] = None
        
        # LSL inlet
        self._inlet = None
        
    def discover(self, timeout: float = 10.0) -> List[DeviceInfo]:
        """Descubre dispositivos Muse disponibles."""
        try:
            from muselsl import list_muses
            
            print(f"🔍 Buscando dispositivos Muse ({timeout}s timeout)...")
            muses = list_muses(timeout=timeout)
            
            devices = []
            for muse in muses:
                devices.append(DeviceInfo(
                    name=muse.get('name', 'Muse'),
                    address=muse['address'],
                    device_type='muse2',
                    rssi=muse.get('rssi')
                ))
            
            if devices:
                print(f"✅ Encontrados {len(devices)} dispositivo(s)")
            else:
                print("⚠️ No se encontraron dispositivos Muse")
                print("   → Verifica que el Muse esté encendido")
                print("   → Verifica que Bluetooth esté activado")
            
            return devices
            
        except ImportError:
            self._error_message = "muselsl no instalado. Ejecutar: pip install muselsl"
            self._status = DeviceStatus.ERROR
            return []
        except Exception as e:
            self._error_message = f"Error en discovery: {str(e)}"
            self._status = DeviceStatus.ERROR
            return []
    
    def connect(self, address: str) -> bool:
        """
        Conecta a un Muse 2 específico.
        
        Inicia muselsl stream como proceso background.
        """
        try:
            self._status = DeviceStatus.CONNECTING
            print(f"🔌 Conectando a Muse: {address}")
            
            # Iniciar muselsl stream en background
            self._muselsl_process = subprocess.Popen(
                [sys.executable, '-m', 'muselsl', 'stream', 
                 '--address', address,
                 '--ppg', '--acc'],  # Incluir sensores extra
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Esperar a que se establezca conexión
            time.sleep(5)
            
            # Verificar que el proceso sigue corriendo
            if self._muselsl_process.poll() is not None:
                stderr = self._muselsl_process.stderr.read().decode()
                self._error_message = f"muselsl falló: {stderr}"
                self._status = DeviceStatus.ERROR
                return False
            
            # Guardar info del dispositivo
            self._device_info = DeviceInfo(
                name="Muse 2",
                address=address,
                device_type='muse2'
            )
            
            self._status = DeviceStatus.CONNECTED
            print(f"✅ Conectado a Muse 2: {address}")
            return True
            
        except FileNotFoundError:
            self._error_message = "muselsl no encontrado en PATH"
            self._status = DeviceStatus.ERROR
            return False
        except Exception as e:
            self._error_message = f"Error de conexión: {str(e)}"
            self._status = DeviceStatus.ERROR
            return False
    
    def disconnect(self) -> None:
        """Desconecta del Muse 2."""
        print("🔌 Desconectando Muse 2...")
        
        # Detener streaming primero
        self.stop_stream()
        
        # Terminar proceso muselsl
        if self._muselsl_process:
            self._muselsl_process.terminate()
            try:
                self._muselsl_process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self._muselsl_process.kill()
            self._muselsl_process = None
        
        # Limpiar estado
        self._device_info = None
        self._status = DeviceStatus.DISCONNECTED
        print("✅ Desconectado")
    
    def connect_to_existing_stream(self) -> bool:
        """
        Conecta a un stream LSL existente (iniciado externamente con start_muse.sh).
        
        Útil cuando el Muse ya está streameando via muselsl en otra terminal.
        """
        try:
            from pylsl import StreamInlet, resolve_byprop
            
            print("📡 Buscando stream EEG existente en LSL...")
            
            # Resolver stream EEG
            streams = resolve_byprop('type', 'EEG', timeout=5)
            
            if not streams:
                self._error_message = "No se encontró stream EEG. ¿Está corriendo start_muse.sh?"
                return False
            
            stream_info = streams[0]
            print(f"✅ Stream encontrado: {stream_info.name()}")
            print(f"   Canales: {stream_info.channel_count()}")
            print(f"   Fs: {stream_info.nominal_srate()} Hz")
            
            # Marcar como conectado
            self._device_info = DeviceInfo(
                name=stream_info.name(),
                address="LSL-EXTERNAL",
                device_type='muse2'
            )
            self._status = DeviceStatus.CONNECTED
            
            return True
            
        except ImportError:
            self._error_message = "pylsl no instalado"
            return False
        except Exception as e:
            self._error_message = f"Error: {str(e)}"
            return False
    
    def start_stream(self) -> bool:
        """Inicia la recepción de datos EEG via LSL."""
        if not self.is_connected:
            self._error_message = "No hay dispositivo conectado"
            return False
        
        try:
            from pylsl import StreamInlet, resolve_byprop
            
            print("📡 Buscando stream EEG en LSL...")
            
            # Resolver stream EEG
            streams = resolve_byprop('type', 'EEG', timeout=10)
            
            if not streams:
                self._error_message = "No se encontró stream EEG en LSL"
                return False
            
            # Crear inlet
            self._inlet = StreamInlet(streams[0])
            print(f"✅ Conectado a stream: {streams[0].name()}")
            
            # Limpiar buffer
            with self._buffer_lock:
                for ch in self.CHANNELS:
                    self._buffer[ch].clear()
                self._timestamps.clear()
            
            # Iniciar thread de recepción
            self._stop_event.clear()
            self._stream_thread = Thread(target=self._stream_loop, daemon=True)
            self._stream_thread.start()
            
            self._status = DeviceStatus.STREAMING
            print("✅ Streaming iniciado")
            return True
            
        except ImportError:
            self._error_message = "pylsl no instalado. Ejecutar: pip install pylsl"
            return False
        except Exception as e:
            self._error_message = f"Error al iniciar stream: {str(e)}"
            return False
    
    def stop_stream(self) -> None:
        """Detiene la recepción de datos."""
        if self._stream_thread:
            self._stop_event.set()
            self._stream_thread.join(timeout=2)
            self._stream_thread = None
        
        if self._inlet:
            self._inlet = None
        
        if self._status == DeviceStatus.STREAMING:
            self._status = DeviceStatus.CONNECTED
        
        print("⏹️ Streaming detenido")
    
    def _stream_loop(self):
        """
        Loop de recepción de datos (ejecuta en thread separado).
        
        Recibe muestras del LSL inlet y las almacena en el buffer circular.
        """
        while not self._stop_event.is_set():
            try:
                # Pull sample con timeout
                sample, timestamp = self._inlet.pull_sample(timeout=1.0)
                
                if sample:
                    with self._buffer_lock:
                        # Agregar a buffers
                        for i, ch in enumerate(self.CHANNELS):
                            if i < len(sample):
                                self._buffer[ch].append(sample[i])
                        self._timestamps.append(timestamp)
                        
            except Exception as e:
                if not self._stop_event.is_set():
                    print(f"⚠️ Error en stream loop: {e}")
                break
    
    def get_window(self, duration: float = 2.0) -> Optional[EEGWindow]:
        """
        Obtiene una ventana de datos EEG del buffer.
        
        Args:
            duration: Duración de la ventana en segundos
            
        Returns:
            EEGWindow o None si no hay suficientes datos
        """
        n_samples_needed = int(self.SAMPLING_RATE * duration)
        
        with self._buffer_lock:
            # Verificar que hay suficientes datos
            if len(self._timestamps) < n_samples_needed:
                return None
            
            # Extraer últimos N samples de cada canal
            data = np.zeros((len(self.CHANNELS), n_samples_needed))
            for i, ch in enumerate(self.CHANNELS):
                buffer_list = list(self._buffer[ch])
                data[i] = buffer_list[-n_samples_needed:]
            
            # Timestamp del inicio de la ventana
            timestamps_list = list(self._timestamps)
            start_timestamp = timestamps_list[-n_samples_needed]
        
        return EEGWindow(
            data=data,
            fs=self.SAMPLING_RATE,
            timestamp=start_timestamp,
            channels=self.CHANNELS.copy(),
            duration=duration
        )
    
    def get_signal_quality(self) -> Dict[str, float]:
        """
        Calcula calidad de señal para cada canal.
        
        Returns:
            Dict {channel_name: quality_score}
        """
        window = self.get_window(duration=1.0)
        
        if window is None:
            return {ch: 0.0 for ch in self.CHANNELS}
        
        quality = {}
        for i, ch in enumerate(self.CHANNELS):
            signal = window.data[i]
            quality[ch] = SignalQualityChecker.compute_quality_score(
                signal, self.SAMPLING_RATE
            )
        
        return quality
    
    def get_buffer_status(self) -> Dict:
        """
        Obtiene estado del buffer.
        
        Returns:
            Dict con info del buffer
        """
        with self._buffer_lock:
            samples_in_buffer = len(self._timestamps)
        
        return {
            'samples': samples_in_buffer,
            'capacity': self._buffer_size,
            'fill_percent': (samples_in_buffer / self._buffer_size) * 100,
            'duration_available': samples_in_buffer / self.SAMPLING_RATE
        }


class MuseToSyntergicAdapter:
    """
    Adapta datos de Muse 2 (4 canales) al formato del sistema Syntergic.
    
    El sistema fue diseñado para 64 canales (PhysioNet), pero las métricas
    de coherencia, entropía y bandas funcionan perfectamente con 4 canales.
    
    Mapping de hemisferios:
    - Left: TP9, AF7 (canales 0, 1)
    - Right: AF8, TP10 (canales 2, 3)
    """
    
    LEFT_CHANNELS = [0, 1]   # TP9, AF7
    RIGHT_CHANNELS = [2, 3]  # AF8, TP10
    
    @staticmethod
    def prepare_for_analysis(eeg_window: EEGWindow) -> Dict:
        """
        Prepara datos Muse para SyntergicMetrics.compute_all().
        
        Args:
            eeg_window: EEGWindow del MuseConnector
            
        Returns:
            Dict compatible con SyntergicMetrics
        """
        data = eeg_window.data  # (4, n_samples)
        
        # Promedio hemisferio izquierdo (TP9 + AF7)
        left_avg = np.mean(data[MuseToSyntergicAdapter.LEFT_CHANNELS], axis=0)
        
        # Promedio hemisferio derecho (AF8 + TP10)
        right_avg = np.mean(data[MuseToSyntergicAdapter.RIGHT_CHANNELS], axis=0)
        
        # Señal global (promedio de todo)
        signal_avg = np.mean(data, axis=0)
        
        return {
            'signal': signal_avg,
            'left_hemisphere': left_avg,
            'right_hemisphere': right_avg,
            'raw_variance': np.var(data)
        }
    
    @staticmethod
    def pad_for_vae(eeg_window: EEGWindow, 
                    target_channels: int = 64,
                    target_samples: int = 161) -> np.ndarray:
        """
        Expande 4 canales a 64 para compatibilidad con VAE pre-entrenado.
        
        NOTA: El VAE fue entrenado con PhysioNet (64 canales), no con Muse.
        Las inferencias de focal_point serán APROXIMADAS.
        Para métricas precisas, usar análisis espectral directo.
        
        Args:
            eeg_window: Datos del Muse
            target_channels: Número de canales objetivo (64)
            target_samples: Número de samples objetivo (161 @ 160Hz)
            
        Returns:
            Array (64, 161) padded
        """
        from scipy import signal
        
        data = eeg_window.data  # (4, n_samples)
        
        # 1. Resample temporal: 256Hz → 160Hz
        current_samples = data.shape[1]
        if current_samples != target_samples:
            resampled = signal.resample(data, target_samples, axis=1)
        else:
            resampled = data
        
        # 2. Padding de canales: repetir patrón 4→64
        n_repeats = target_channels // 4
        padded = np.tile(resampled, (n_repeats, 1))  # (64, 161)
        
        return padded
    
    @staticmethod
    def compute_focal_point_from_bands(bands: Dict[str, float]) -> Dict[str, float]:
        """
        Genera un focal point sintético basado en las bandas de frecuencia.
        
        Como Muse 2 solo tiene 4 canales, no podemos hacer source localization
        real. Usamos las bandas para crear una representación visual coherente.
        
        - Alpha alto → Centro (meditación, coherencia)
        - Beta alto → Frontal (concentración)
        - Theta alto → Posterior (creatividad, memoria)
        - Gamma alto → Arriba (insight, procesamiento)
        - Delta alto → Abajo (sueño, inconsciente)
        
        Args:
            bands: Dict con potencias por banda
            
        Returns:
            Dict con x, y, z en rango [-1, 1]
        """
        # Normalizar bandas a suma = 1
        total = sum(bands.values())
        if total > 0:
            bands_norm = {k: v/total for k, v in bands.items()}
        else:
            bands_norm = bands
        
        # Mapeo a coordenadas 3D
        x = (bands_norm.get('beta', 0) - bands_norm.get('theta', 0)) * 2  # Frontal vs Posterior
        y = (bands_norm.get('gamma', 0) - bands_norm.get('delta', 0)) * 2  # Arriba vs Abajo
        z = (bands_norm.get('alpha', 0) - 0.2) * 2  # Centro cuando alpha alto
        
        # Clamp a [-1, 1]
        x = max(-1, min(1, x))
        y = max(-1, min(1, y))
        z = max(-1, min(1, z))
        
        return {'x': x, 'y': y, 'z': z}


# ============================================================
# TESTING / DEMO
# ============================================================

def demo_muse_connection():
    """
    Demo de conexión con Muse 2.
    
    Ejecutar: python -m backend.hardware.muse
    """
    print("=" * 60)
    print("MUSE 2 CONNECTION DEMO")
    print("=" * 60)
    
    muse = MuseConnector()
    
    # 1. Discover
    devices = muse.discover(timeout=10)
    
    if not devices:
        print("\n❌ No se encontraron dispositivos")
        return
    
    # 2. Connect
    print(f"\n→ Conectando a: {devices[0].name} ({devices[0].address})")
    if not muse.connect(devices[0].address):
        print(f"❌ Error: {muse.error_message}")
        return
    
    # 3. Start stream
    print("\n→ Iniciando stream...")
    if not muse.start_stream():
        print(f"❌ Error: {muse.error_message}")
        muse.disconnect()
        return
    
    # 4. Capturar datos
    print("\n📊 Capturando datos (10 segundos)...")
    time.sleep(5)  # Llenar buffer
    
    for i in range(5):
        window = muse.get_window(duration=2.0)
        if window:
            print(f"\n--- Ventana {i+1} ---")
            print(f"Shape: {window.data.shape}")
            print(f"Timestamp: {window.timestamp:.2f}")
            
            # Quality
            quality = muse.get_signal_quality()
            print(f"Calidad: {quality}")
            
            # Preparar para análisis
            data = MuseToSyntergicAdapter.prepare_for_analysis(window)
            print(f"Left mean: {np.mean(data['left_hemisphere']):.2f} µV")
            print(f"Right mean: {np.mean(data['right_hemisphere']):.2f} µV")
        else:
            print(f"⚠️ No hay suficientes datos (ventana {i+1})")
        
        time.sleep(2)
    
    # 5. Cleanup
    print("\n→ Desconectando...")
    muse.disconnect()
    print("\n✅ Demo completado")


if __name__ == '__main__':
    demo_muse_connection()