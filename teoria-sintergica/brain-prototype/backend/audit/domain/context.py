"""
audit/domain/context.py

AuditContext — value object shared across all probes in a single run.
Carries config + a shared cache so the site is fetched once.
"""
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import urlparse


@dataclass
class AuditContext:
    run_id:   str
    root_url: str
    sku:      str
    config:   dict[str, Any]       = field(default_factory=dict)
    # Shared cache populated during pre-warming
    cache:    dict[str, Any]       = field(default_factory=dict)

    @property
    def domain(self) -> str:
        parsed = urlparse(self.root_url)
        return parsed.netloc or self.root_url

    @property
    def base_url(self) -> str:
        parsed = urlparse(self.root_url)
        return f"{parsed.scheme}://{parsed.netloc}"

    def get(self, key: str, default: Any = None) -> Any:
        return self.cache.get(key, default)
