"""
Base classes for EEG hardware integration.

Provides abstract interfaces and common data structures for all EEG devices.
Designed to support Muse 2, OpenBCI, and future devices.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, List
import numpy as np


class DeviceStatus(Enum):
    """Estado del dispositivo EEG."""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    STREAMING = "streaming"
    ERROR = "error"


@dataclass
class DeviceInfo:
    """Información de un dispositivo EEG descubierto."""
    name: str
    address: str
    device_type: str  # 'muse2', 'openbci', etc.
    rssi: Optional[int] = None  # Signal strength (Bluetooth)
    battery_level: Optional[int] = None  # 0-100%
    
    def to_dict(self) -> Dict:
        return {
            'name': self.name,
            'address': self.address,
            'device_type': self.device_type,
            'rssi': self.rssi,
            'battery_level': self.battery_level
        }


@dataclass
class EEGWindow:
    """
    Ventana de datos EEG capturados.
    
    Estructura estándar para pasar datos entre componentes.
    """
    data: np.ndarray          # (n_channels, n_samples)
    fs: int                   # Sampling rate (Hz)
    timestamp: float          # Unix timestamp del inicio
    channels: List[str]       # Nombres de canales
    duration: float           # Duración en segundos
    
    def to_dict(self) -> Dict:
        return {
            'shape': self.data.shape,
            'fs': self.fs,
            'timestamp': self.timestamp,
            'channels': self.channels,
            'duration': self.duration
        }


class EOGDetector:
    """
    Detects eye-blink (EOG) artifacts in EEG windows.

    Blinks generate 100-800µV transients at the cornea that propagate via
    volume conduction to ALL electrodes, including posterior TP9/TP10.
    This contaminates alpha measurements (Berger effect, calibration,
    live visualization, recorded data).

    Detection strategy: use frontal channels AF7/AF8 as EOG sensors.
    When their absolute amplitude exceeds a threshold, the window is
    flagged as blink-contaminated.

    Usage:
        window = muse.get_window(2.0)
        is_blink = EOGDetector.detect(window.data, window.fs)
    """

    # Amplitude threshold for frontal channels (µV).
    # Normal EEG: 10-50µV.  Blink artifact: 100-800µV.
    # 80µV is conservative — catches all real blinks while ignoring
    # normal frontal activity and small saccades.
    FRONTAL_BLINK_THRESHOLD = 80.0  # µV peak amplitude

    # Fraction of samples above threshold to flag the window.
    # A blink lasts ~200-400ms in a 2s window = 5-10% of samples.
    # Even 1% of samples above threshold indicates contamination
    # because the Welch PSD spreads the energy across the whole window.
    CONTAMINATION_FRACTION = 0.005  # 0.5% of samples

    @staticmethod
    def detect(data: np.ndarray, fs: int = 256,
               frontal_indices: tuple = (1, 2)) -> bool:
        """
        Detect blink artifacts in an EEG window.

        Args:
            data: (n_channels, n_samples) raw EEG
            fs: sampling rate
            frontal_indices: channel indices for AF7, AF8

        Returns:
            True if blink artifact detected in this window
        """
        if data.shape[0] < max(frontal_indices) + 1:
            return False

        # Average frontal channels
        frontal = np.mean(
            [data[i] for i in frontal_indices], axis=0
        )

        # Count samples above blink threshold
        n_above = np.sum(
            np.abs(frontal) > EOGDetector.FRONTAL_BLINK_THRESHOLD
        )
        fraction = n_above / len(frontal)

        return bool(fraction > EOGDetector.CONTAMINATION_FRACTION)

    @staticmethod
    def detect_detailed(data: np.ndarray, fs: int = 256,
                        frontal_indices: tuple = (1, 2)) -> dict:
        """
        Detailed blink detection with diagnostics.

        Returns:
            Dict with detection result and diagnostics:
            {
                'blink_detected': bool,
                'frontal_peak_uv': float,
                'fraction_above': float,
                'n_blinks_estimated': int,
            }
        """
        if data.shape[0] < max(frontal_indices) + 1:
            return {
                'blink_detected': False,
                'frontal_peak_uv': 0.0,
                'fraction_above': 0.0,
                'n_blinks_estimated': 0,
            }

        frontal = np.mean(
            [data[i] for i in frontal_indices], axis=0
        )
        frontal_abs = np.abs(frontal)

        peak = float(np.max(frontal_abs))
        n_above = int(np.sum(frontal_abs > EOGDetector.FRONTAL_BLINK_THRESHOLD))
        fraction = n_above / len(frontal)

        # Estimate number of blinks: each blink ~100-400ms
        # at 256Hz that's 25-100 samples per blink
        blink_samples = max(int(0.3 * fs), 1)  # ~300ms per blink
        n_blinks = max(1, n_above // blink_samples) if n_above > 0 else 0

        return {
            'blink_detected': bool(fraction > EOGDetector.CONTAMINATION_FRACTION),
            'frontal_peak_uv': peak,
            'fraction_above': round(fraction, 4),
            'n_blinks_estimated': n_blinks,
        }


class SignalQualityChecker:
    """
    Utilidades para verificar calidad de señal EEG.
    
    Detecta:
    - Artefactos de movimiento
    - Pérdida de contacto
    - Ruido excesivo
    """
    
    # Thresholds para Muse 2 (µV)
    MIN_AMPLITUDE = 5.0      # Señal muy baja = mal contacto
    MAX_AMPLITUDE = 200.0    # Señal muy alta = artefacto
    MAX_STD = 100.0          # Desviación estándar máxima
    
    @staticmethod
    def compute_quality_score(signal: np.ndarray, fs: int) -> float:
        """
        Calcula score de calidad de señal [0, 1].
        
        Args:
            signal: Array 1D de muestras
            fs: Sampling rate
            
        Returns:
            Score de calidad (1.0 = perfecto, 0.0 = malo)
        """
        if len(signal) == 0:
            return 0.0
        
        abs_signal = np.abs(signal)
        
        # Usar percentil 99 en lugar de max para ignorar spikes aislados de BLE.
        # np.max() se dispara con 1-2 samples malos en 256 (BLE retransmission artifact),
        # causando la oscilación 100→30 cada 3-5s que se ve en la UI.
        # p99 ignora los ~2 samples más ruidosos sin afectar artefactos sostenidos.
        amplitude = np.percentile(abs_signal, 99)
        std = np.std(signal)
        
        # Penalizar si muy bajo (mal contacto)
        if amplitude < SignalQualityChecker.MIN_AMPLITUDE:
            return 0.2
        
        # Penalizar si muy alto (artefacto sostenido — no spike aislado)
        if amplitude > SignalQualityChecker.MAX_AMPLITUDE:
            return 0.3
        
        # Penalizar ruido excesivo
        if std > SignalQualityChecker.MAX_STD:
            return 0.5
        
        # Score basado en estabilidad
        # Ideal: std entre 10-50 µV
        if 10 <= std <= 50:
            return 1.0
        elif std < 10:
            return 0.7 + (std / 10) * 0.3
        else:  # 50 < std <= MAX_STD
            return 1.0 - ((std - 50) / (SignalQualityChecker.MAX_STD - 50)) * 0.5
    
    @staticmethod
    def check_electrode_contact(channel_data: Dict[str, np.ndarray]) -> Dict[str, bool]:
        """
        Verifica contacto de cada electrodo.
        
        Args:
            channel_data: Dict {nombre_canal: señal}
            
        Returns:
            Dict {nombre_canal: tiene_buen_contacto}
        """
        contact = {}
        for ch_name, signal in channel_data.items():
            std = np.std(signal)
            amplitude = np.max(np.abs(signal))
            
            # Buen contacto: señal presente pero no saturada
            contact[ch_name] = (
                SignalQualityChecker.MIN_AMPLITUDE < amplitude < SignalQualityChecker.MAX_AMPLITUDE
                and std < SignalQualityChecker.MAX_STD
            )
        
        return contact


class EEGDevice(ABC):
    """
    Clase abstracta base para dispositivos EEG.
    
    Define la interfaz común que deben implementar todos los conectores
    de hardware (Muse 2, OpenBCI, etc.).
    
    Usage:
        class MyDevice(EEGDevice):
            def discover(self) -> List[DeviceInfo]: ...
            def connect(self, address: str) -> bool: ...
            # ... implementar todos los métodos abstractos
    """
    
    def __init__(self):
        self._status = DeviceStatus.DISCONNECTED
        self._device_info: Optional[DeviceInfo] = None
        self._error_message: Optional[str] = None
    
    # --- Properties ---
    
    @property
    def status(self) -> DeviceStatus:
        """Estado actual del dispositivo."""
        return self._status
    
    @property
    def is_connected(self) -> bool:
        """True si hay conexión activa."""
        return self._status in (DeviceStatus.CONNECTED, DeviceStatus.STREAMING)
    
    @property
    def is_streaming(self) -> bool:
        """True si está enviando datos."""
        return self._status == DeviceStatus.STREAMING
    
    @property
    def device_info(self) -> Optional[DeviceInfo]:
        """Información del dispositivo conectado."""
        return self._device_info
    
    @property
    def error_message(self) -> Optional[str]:
        """Último mensaje de error."""
        return self._error_message
    
    # --- Abstract Methods ---
    
    @abstractmethod
    def discover(self, timeout: float = 10.0) -> List[DeviceInfo]:
        """
        Descubre dispositivos disponibles.
        
        Args:
            timeout: Tiempo máximo de búsqueda en segundos
            
        Returns:
            Lista de dispositivos encontrados
        """
        pass
    
    @abstractmethod
    def connect(self, address: str) -> bool:
        """
        Conecta a un dispositivo específico.
        
        Args:
            address: Dirección del dispositivo (MAC address para BLE)
            
        Returns:
            True si la conexión fue exitosa
        """
        pass
    
    @abstractmethod
    def disconnect(self) -> None:
        """Desconecta del dispositivo actual."""
        pass
    
    @abstractmethod
    def start_stream(self) -> bool:
        """
        Inicia el streaming de datos.
        
        Returns:
            True si se inició correctamente
        """
        pass
    
    @abstractmethod
    def stop_stream(self) -> None:
        """Detiene el streaming de datos."""
        pass
    
    @abstractmethod
    def get_window(self, duration: float = 2.0) -> Optional[EEGWindow]:
        """
        Obtiene una ventana de datos EEG.
        
        Args:
            duration: Duración de la ventana en segundos
            
        Returns:
            EEGWindow con los datos o None si no hay suficientes
        """
        pass
    
    # --- Common Methods ---
    
    def get_status(self) -> Dict:
        """
        Retorna estado completo del dispositivo.
        
        Returns:
            Dict con status, device_info, error_message
        """
        return {
            'status': self._status.value,
            'is_connected': self.is_connected,
            'is_streaming': self.is_streaming,
            'device_info': self._device_info.to_dict() if self._device_info else None,
            'error_message': self._error_message
        }
    
    def __repr__(self) -> str:
        device_name = self._device_info.name if self._device_info else "No device"
        return f"<{self.__class__.__name__} status={self._status.value} device='{device_name}'>"
