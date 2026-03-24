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
    
    # Muse GATT telemetry characteristic (battery + temp)
    MUSE_TELEMETRY_UUID = '273e000b-4c4d-454d-96be-f03bac821358'
    
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
        
        # Stale data detection: track when last sample arrived
        self._last_sample_time: float = 0.0
        self._stale_threshold: float = 3.0  # seconds without new data → stale
        
        # Proceso de muselsl
        self._muselsl_process: Optional[subprocess.Popen] = None
        
        # LSL inlet
        self._inlet = None
        
    def discover(self, timeout: float = 10.0) -> List[DeviceInfo]:
        """
        Descubre dispositivos Muse disponibles via BleakScanner directamente.

        Bypaseamos muselsl.list_muses() porque su backends.py usa
        asyncio.get_event_loop() (deprecated en Python 3.10+) que lanza
        RuntimeError en threads sin event loop (Python 3.13).

        Se ejecuta siempre desde asyncio.to_thread() en main.py.
        """
        import asyncio
        import traceback

        try:
            from bleak import BleakScanner
        except ImportError:
            self._error_message = "bleak no instalado. Ejecutar: pip install bleak"
            self._status = DeviceStatus.ERROR
            print("[discover] ERROR: bleak no instalado")
            return []

        print(f"[discover] BleakScanner.discover(timeout={timeout}) — iniciando BLE scan...")

        # Python 3.13: los threads no tienen event loop. Creamos uno.
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            ble_devices = loop.run_until_complete(
                BleakScanner.discover(timeout=timeout)
            )
        except Exception as e:
            print(f"[discover] Exception en BleakScanner: {e}")
            traceback.print_exc()
            self._error_message = f"Error en BLE scan: {e}"
            self._status = DeviceStatus.ERROR
            return []
        finally:
            loop.close()
            asyncio.set_event_loop(None)

        print(f"[discover] BLE scan completo. Total dispositivos BT: {len(ble_devices)}")

        devices = []
        for d in ble_devices:
            name = d.name or ''
            print(f"[discover]   {name!r:30s} | {d.address}")
            if 'muse' in name.lower():
                rssi = getattr(d, 'rssi', None)
                print(f"[discover]   ✅ MUSE: {name} | {d.address} | RSSI: {rssi}")
                devices.append(DeviceInfo(
                    name=name,
                    address=d.address,
                    device_type='muse2',
                    rssi=rssi,
                ))

        if devices:
            print(f"[discover] ✅ {len(devices)} Muse encontrado(s)")
        else:
            print("[discover] ⚠️  Ningún Muse encontrado entre los dispositivos BT visibles")

        return devices
    
    def connect(self, address: str) -> bool:
        """
        Conecta a un Muse 2 específico.
        
        Inicia muselsl stream como proceso background.
        """
        try:
            self._status = DeviceStatus.CONNECTING
            print(f"🔌 Conectando a Muse: {address}")
            
            # Leer batería ANTES de iniciar muselsl — el Muse solo acepta una conexión BLE
            # a la vez. Si leemos batería y muselsl se conectan en paralelo, uno falla.
            print(f"[connect] Leyendo batería de {address}...")
            battery = self.read_battery(address)
            if battery is not None:
                print(f"[connect] Batería: {battery}%")
            else:
                print(f"[connect] Batería: no disponible")

            # Iniciar muselsl stream en background.
            # En macOS el address es un UUID con guiones (6D5F179A-C0AF-...) — formato CoreBluetooth.
            # NO convertir a colons: Bleak en macOS necesita el formato UUID.
            self._muselsl_process = subprocess.Popen(
                [sys.executable, '-m', 'muselsl', 'stream',
                 '--address', address],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Log muselsl stderr en background para diagnosticar desconexiones BLE
            self._muselsl_log_thread = Thread(
                target=self._log_muselsl_stderr, daemon=True
            )
            self._muselsl_log_thread.start()

            # Esperar a que se establezca conexión
            time.sleep(5)

            # Verificar que el proceso sigue corriendo
            if self._muselsl_process.poll() is not None:
                stderr = self._muselsl_process.stderr.read().decode()
                self._error_message = f"muselsl falló: {stderr}"
                self._status = DeviceStatus.ERROR
                return False

            # Guardar info del dispositivo (incluyendo batería)
            self._device_info = DeviceInfo(
                name="Muse 2",
                address=address,
                device_type='muse2',
                battery_level=battery
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

    def _log_muselsl_stderr(self):
        """Lee stderr de muselsl en background para diagnosticar desconexiones BLE."""
        proc = self._muselsl_process
        if not proc or not proc.stderr:
            return
        for line in iter(proc.stderr.readline, b''):
            text = line.decode('utf-8', errors='ignore').strip()
            if text:
                print(f"[muselsl-stderr] {text}")
        
        # El pipe se cerró = muselsl murió
        exit_code = proc.poll()
        print(f"⚠️ [muselsl] Proceso terminó (exit code: {exit_code})")
        
        # Auto-restart si no fue un stop intencional
        if not self._stop_event.is_set() and self._device_info:
            address = self._device_info.address
            if address and address != "LSL-EXTERNAL":
                print(f"🔄 [muselsl] Auto-reiniciando stream para {address}...")
                time.sleep(3)  # esperar a que BLE se libere
                try:
                    self._muselsl_process = subprocess.Popen(
                        [sys.executable, '-m', 'muselsl', 'stream',
                         '--address', address],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE
                    )
                    # Re-lanzar logger de stderr
                    Thread(target=self._log_muselsl_stderr, daemon=True).start()
                    print(f"✅ [muselsl] Proceso reiniciado (PID: {self._muselsl_process.pid})")
                    
                    # Esperar y reconectar inlet
                    time.sleep(5)
                    if not self._stop_event.is_set():
                        from pylsl import StreamInlet, resolve_byprop
                        streams = resolve_byprop('type', 'EEG', timeout=10)
                        if streams:
                            self._inlet = StreamInlet(streams[0])
                            self._last_sample_time = time.time()
                            print(f"✅ [muselsl] LSL stream reconectado: {streams[0].name()}")
                        else:
                            print("⚠️ [muselsl] Proceso reinició pero no aparece stream LSL")
                except Exception as e:
                    print(f"❌ [muselsl] Error en auto-restart: {e}")
    
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

    def read_battery(self, address: str) -> Optional[int]:
        """
        Lee el nivel de batería del Muse vía BLE.

        Conecta brevemente con BleakClient, suscribe a la característica de
        telemetría y espera la primera notificación para extraer la batería.
        Solo funciona ANTES de que muselsl ocupe la conexión BLE.

        Returns:
            Nivel de batería 0-100, o None si no se pudo leer.
        """
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self._read_battery_async(address))
        finally:
            loop.close()
            asyncio.set_event_loop(None)

    async def _read_battery_async(self, address: str) -> Optional[int]:
        """Lógica async de lectura de batería.

        En lugar de esperar la característica de telemetría (que sólo envía
        datos periódicamente), enviamos el comando 's' (ask_control) al
        control characteristic. La respuesta incluye directamente el campo
        \"bp\" (battery percentage) como número 0-100.

        Comando: [0x02, 0x73, 0x0a] = len('s')+1, ord('s'), ord('\\n')
        Respuesta: JSON-like string, e.g. {\"rc\":0,\"bp\":50,...}
        """
        import asyncio
        import json
        import re
        from bleak import BleakClient

        # Muse GATT control characteristic (stream toggle + command channel)
        CONTROL_UUID = '273e0001-4c4d-454d-96be-f03bac821358'
        # 'ask_control' command: _write_cmd_str('s') → [len+1, ord('s'), ord('\n')]
        CMD_ASK_CONTROL = bytes([0x02, 0x73, 0x0a])

        battery_pct = None
        event = asyncio.Event()
        buf = []

        def on_control(sender, data):
            """Accumulate control response chunks until we get 'rc' (end marker)."""
            nonlocal battery_pct
            try:
                chunk = bytes(data).decode('utf-8', errors='ignore').strip()
                buf.append(chunk)
                combined = ''.join(buf)
                # Response arrives in chunks; wait until we have the end marker
                if 'rc' in combined:
                    # Extract bp field: {"bp":50,...} or bp":50
                    m = re.search(r'"bp"\s*:\s*(\d+)', combined)
                    if m:
                        battery_pct = int(m.group(1))
                        print(f"[battery] {address}: {battery_pct}% (from control response)")
                    else:
                        print(f"[battery] Control response sin bp: {combined!r}")
                    event.set()
            except Exception as e:
                print(f"[battery] Error parseando control response: {e}")
                event.set()

        try:
            async with BleakClient(address, timeout=8.0) as client:
                await client.start_notify(CONTROL_UUID, on_control)
                # Request control info (returns bp, sn, hn, etc.)
                await client.write_gatt_char(CONTROL_UUID, CMD_ASK_CONTROL, response=False)
                try:
                    await asyncio.wait_for(event.wait(), timeout=4.0)
                except asyncio.TimeoutError:
                    print(f"[battery] Timeout esperando control response de {address}")
                try:
                    await client.stop_notify(CONTROL_UUID)
                except Exception:
                    pass
        except Exception as e:
            print(f"[battery] Error BLE {address}: {e}")

        return battery_pct

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
        Si el stream se pierde (BLE disconnect), detecta stale data y reconecta.
        """
        reconnect_attempts = 0
        max_reconnect = 5
        stale_logged = False
        
        while not self._stop_event.is_set():
            try:
                # Pull sample con timeout
                sample, timestamp = self._inlet.pull_sample(timeout=1.0)
                
                if sample:
                    reconnect_attempts = 0  # reset on successful read
                    if stale_logged:
                        print("✅ Stream recuperado — datos fluyendo de nuevo")
                        stale_logged = False
                    with self._buffer_lock:
                        # Agregar a buffers
                        for i, ch in enumerate(self.CHANNELS):
                            if i < len(sample):
                                self._buffer[ch].append(sample[i])
                        self._timestamps.append(timestamp)
                        self._last_sample_time = time.time()
                else:
                    # pull_sample retornó None — no hay datos
                    # Detectar si llevamos mucho sin datos (BLE drop silencioso)
                    if self._last_sample_time > 0:
                        gap = time.time() - self._last_sample_time
                        if gap > self._stale_threshold and not stale_logged:
                            print(f"⚠️ Stream stale: {gap:.1f}s sin datos EEG. Posible desconexión BLE.")
                            stale_logged = True
                        
                        if gap > 8.0:
                            # Más de 8s sin datos: intentar reconectar LSL
                            reconnect_attempts += 1
                            if reconnect_attempts > max_reconnect:
                                print("❌ Stream loop: máximo de reconexiones alcanzado.")
                                self._status = DeviceStatus.ERROR
                                self._error_message = "BLE desconectado — sin datos por >8s tras 5 intentos"
                                break
                            
                            print(f"🔄 Reconectando LSL stream (intento {reconnect_attempts}/{max_reconnect})...")
                            try:
                                from pylsl import StreamInlet, resolve_byprop
                                streams = resolve_byprop('type', 'EEG', timeout=5)
                                if streams:
                                    self._inlet = StreamInlet(streams[0])
                                    self._last_sample_time = time.time()  # reset timer
                                    stale_logged = False
                                    print(f"✅ Reconectado a LSL stream: {streams[0].name()}")
                                else:
                                    print("⚠️ No se encontró stream LSL. muselsl puede estar reconectando BLE...")
                            except Exception as re_err:
                                print(f"⚠️ Error en reconexión LSL: {re_err}")
                        
            except Exception as e:
                if self._stop_event.is_set():
                    break
                print(f"⚠️ Excepción en stream loop: {e}")
                reconnect_attempts += 1
                if reconnect_attempts >= max_reconnect:
                    print("❌ Stream loop: máximo de reconexiones alcanzado. Deteniendo.")
                    self._status = DeviceStatus.ERROR
                    self._error_message = f"LSL stream perdido tras {max_reconnect} intentos: {e}"
                    break
                time.sleep(2)
    
    @property
    def is_data_stale(self) -> bool:
        """True if no new EEG samples have arrived for > stale_threshold seconds."""
        if self._last_sample_time == 0:
            return True
        return (time.time() - self._last_sample_time) > self._stale_threshold

    def get_window(self, duration: float = 2.0) -> Optional[EEGWindow]:
        """
        Obtiene una ventana de datos EEG del buffer.
        
        Returns None if:
          - Not enough samples in buffer
          - Data is stale (no new samples for > 3s, e.g. BLE disconnect)
        
        Args:
            duration: Duración de la ventana en segundos
            
        Returns:
            EEGWindow o None si no hay suficientes datos o datos stale
        """
        # Stale data guard: if BLE dropped, don't return old buffer data
        if self.is_data_stale:
            return None
        
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
            Dict con info del buffer, including stale detection
        """
        with self._buffer_lock:
            samples_in_buffer = len(self._timestamps)
        
        since_last = time.time() - self._last_sample_time if self._last_sample_time > 0 else -1
        
        return {
            'samples': samples_in_buffer,
            'capacity': self._buffer_size,
            'fill_percent': (samples_in_buffer / self._buffer_size) * 100,
            'duration_available': samples_in_buffer / self.SAMPLING_RATE,
            'is_stale': self.is_data_stale,
            'seconds_since_last_sample': round(since_last, 1),
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