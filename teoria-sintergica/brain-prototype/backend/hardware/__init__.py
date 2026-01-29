"""
Hardware integration module for Syntergic Brain.

Provides connectors for EEG devices:
- Muse 2 (via muselsl/LSL)
- OpenBCI (planned)
- Custom devices (via base class)

Usage:
    from hardware import MuseConnector, MuseToSyntergicAdapter
    
    muse = MuseConnector()
    devices = muse.discover()
    muse.connect(devices[0].address)
    muse.start_stream()
    
    window = muse.get_window(duration=2.0)
    data = MuseToSyntergicAdapter.prepare_for_analysis(window)
"""

from .base import (
    EEGDevice,
    DeviceStatus,
    DeviceInfo,
    EEGWindow,
    SignalQualityChecker
)

from .muse import (
    MuseConnector,
    MuseToSyntergicAdapter
)

__all__ = [
    # Base classes
    'EEGDevice',
    'DeviceStatus', 
    'DeviceInfo',
    'EEGWindow',
    'SignalQualityChecker',
    # Muse
    'MuseConnector',
    'MuseToSyntergicAdapter',
]
