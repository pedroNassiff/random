"""
audit/domain/ports.py

Port (abstract interface) that every probe must implement.
Dependencies flow inward — probes depend on this, not on infra.
"""
from abc import ABC, abstractmethod
from .context import AuditContext
from .entities import ProbeOutput
from .enums import Category, Layer


class ProbeBase(ABC):
    key:      str           # unique probe identifier
    category: Category
    layer:    Layer = Layer.PASSIVE_LAYER_1
    requires: list[str] = []   # probe keys that must run first

    @abstractmethod
    async def run(self, ctx: AuditContext) -> ProbeOutput:
        """Execute the probe and return structured output."""

    def __repr__(self) -> str:
        return f"<Probe {self.key}>"
