"""
Automation Config - Configuración del módulo de automatización
"""
import os
from typing import Optional


class AutomationConfig:
    """Configuración centralizada para el módulo de automatización"""
    
    # Claude API (para scoring y generación de contenido)
    CLAUDE_API_KEY: Optional[str] = os.getenv("CLAUDE_API_KEY")
    CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
    CLAUDE_MAX_TOKENS: int = int(os.getenv("CLAUDE_MAX_TOKENS", "2000"))
    
    # Rate Limits por defecto
    DEFAULT_RATE_LIMIT_HOUR: int = 100
    DEFAULT_RATE_LIMIT_DAY: int = 1000
    
    # LinkedIn API (cuando esté listo)
    LINKEDIN_CLIENT_ID: Optional[str] = os.getenv("LINKEDIN_CLIENT_ID")
    LINKEDIN_CLIENT_SECRET: Optional[str] = os.getenv("LINKEDIN_CLIENT_SECRET")
    
    # Resend (email)
    RESEND_API_KEY: Optional[str] = os.getenv("RESEND_API_KEY")
    
    # Apify (scraping)
    APIFY_API_KEY: Optional[str] = os.getenv("APIFY_API_KEY")
    
    # n8n Webhooks
    N8N_WEBHOOK_BASE_URL: str = os.getenv("N8N_WEBHOOK_BASE_URL", "http://localhost:5678")
    
    # Feature Flags
    ENABLE_AUTO_SCORING: bool = os.getenv("ENABLE_AUTO_SCORING", "true").lower() == "true"
    ENABLE_AUTO_PUBLISHING: bool = os.getenv("ENABLE_AUTO_PUBLISHING", "false").lower() == "true"
    REQUIRE_APPROVAL_FOR_CONTENT: bool = os.getenv("REQUIRE_APPROVAL_FOR_CONTENT", "true").lower() == "true"
    
    # Sistema de aprobaciones
    AUTO_APPROVE_THRESHOLD: int = int(os.getenv("AUTO_APPROVE_THRESHOLD", "90"))  # Score > 90 auto-aprueba
    
    @classmethod
    def is_configured(cls) -> bool:
        """Check si las configuraciones mínimas están presentes"""
        return True  # Por ahora siempre True, el módulo funciona sin APIs externas
    
    @classmethod
    def get_missing_configs(cls) -> list[str]:
        """Retorna lista de configuraciones faltantes"""
        missing = []
        
        if not cls.CLAUDE_API_KEY:
            missing.append("CLAUDE_API_KEY (opcional - usa scoring dummy)")
        
        if not cls.RESEND_API_KEY:
            missing.append("RESEND_API_KEY (opcional - para email)")
        
        if not cls.APIFY_API_KEY:
            missing.append("APIFY_API_KEY (opcional - para scraping)")
        
        return missing


# Singleton
config = AutomationConfig()


# Ejemplo de .env:
"""
# Claude API
CLAUDE_API_KEY=sk-ant-api03-xxx
CLAUDE_MODEL=claude-sonnet-4-20250514
CLAUDE_MAX_TOKENS=2000

# LinkedIn (cuando esté listo)
# LINKEDIN_CLIENT_ID=xxx
# LINKEDIN_CLIENT_SECRET=xxx

# Email
# RESEND_API_KEY=re_xxx

# Scraping
# APIFY_API_KEY=apify_api_xxx

# n8n
N8N_WEBHOOK_BASE_URL=http://localhost:5678

# Feature Flags
ENABLE_AUTO_SCORING=true
ENABLE_AUTO_PUBLISHING=false
REQUIRE_APPROVAL_FOR_CONTENT=true
AUTO_APPROVE_THRESHOLD=90
"""
