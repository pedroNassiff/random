"""
ValidationProtocol — Protocolo de grabación científica estructurada.

Automatiza un protocolo de 30 min con 8 fases para validación EEG:
  1. Baseline ojos abiertos (2 min)
  2. Baseline ojos cerrados (2 min)
  3. Shamatha (5 min)
  4. Meditación libre (10 min)
  5. Tarea cognitiva (1 min)
  6. Recovery (3 min)
  7. Profundización (5 min)
  8. Cierre (2 min)

El frontend controla las transiciones; el backend gestiona
marcadores, timing y recording automático.

Usage:
    protocol = ValidationProtocol(session_recorder)
    protocol.start(name="Sesión 1", metadata={"sleep_quality": 4})
    state = protocol.get_state()
    protocol.advance_phase()
    summary = protocol.stop()
"""

import time
import json
from typing import Optional, Dict, List, Any
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, field, asdict


@dataclass
class ProtocolPhase:
    """Definición de una fase del protocolo."""
    name: str
    label: str
    duration: int  # segundos
    instruction: str
    sub_instruction: str = ""
    has_drishti: bool = False
    drishti_color: Optional[str] = None
    breathing_guide: bool = False
    audio_freq: Optional[int] = None
    bell_on_start: bool = True
    bell_on_end: bool = False
    text_color: Optional[str] = None
    tts_on_start: Optional[str] = None
    tts_on_end: Optional[str] = None


VALIDATION_PHASES: List[ProtocolPhase] = [
    ProtocolPhase(
        name="baseline_open",
        label="BASELINE",
        duration=120,
        instruction="Ojos abiertos",
        sub_instruction="Mirá el punto",
        has_drishti=True,
        drishti_color="#5DCAA5",
        audio_freq=528,
        tts_on_start="Mantené los ojos abiertos. Mirá el punto en el centro.",
    ),
    ProtocolPhase(
        name="baseline_closed",
        label="BASELINE",
        duration=120,
        instruction="Cerrá los ojos",
        sub_instruction="Sin hacer nada",
        audio_freq=396,
        bell_on_end=True,
        tts_on_start="Cerrá los ojos. No hagas nada.",
        tts_on_end="Podés abrir los ojos.",
    ),
    ProtocolPhase(
        name="shamatha",
        label="SHAMATHA",
        duration=300,
        instruction="Atención en la respiración",
        sub_instruction="Sentí el aire entrar y salir",
        breathing_guide=True,
        audio_freq=432,
        tts_on_start="Llevá la atención a la respiración. Sentí el aire.",
    ),
    ProtocolPhase(
        name="meditation_free",
        label="MEDITACIÓN LIBRE",
        duration=600,
        instruction="Meditación libre",
        sub_instruction="Sin instrucción, a tu ritmo",
        audio_freq=528,
        tts_on_start="Meditación libre. Sin instrucción.",
    ),
    ProtocolPhase(
        name="cognitive_task",
        label="TAREA COGNITIVA",
        duration=60,
        instruction="1000 - 7 = ?",
        sub_instruction="Restá de 7 en 7 mentalmente",
        audio_freq=639,
        text_color="#EF9F27",
        tts_on_start="Empezá a restar de siete en siete desde mil.",
    ),
    ProtocolPhase(
        name="recovery",
        label="RECUPERACIÓN",
        duration=180,
        instruction="Soltá el esfuerzo",
        sub_instruction="Dejá que la mente se aquiete",
        breathing_guide=True,
        audio_freq=528,
        tts_on_start="Soltá el esfuerzo. Dejá que la mente se aquiete.",
    ),
    ProtocolPhase(
        name="deep_meditation",
        label="PROFUNDIZACIÓN",
        duration=300,
        instruction="Soltá todo",
        sub_instruction="Ni siquiera meditás. Solo estás.",
        tts_on_start="Soltá todo. Solo estás.",
    ),
    ProtocolPhase(
        name="close",
        label="CIERRE",
        duration=120,
        instruction="Volvé al cuerpo",
        sub_instruction="Abrí los ojos cuando suene la campana",
        bell_on_end=True,
        tts_on_start="Empezá a volver. Sentí el cuerpo.",
        tts_on_end="Abrí los ojos.",
    ),
]


@dataclass
class ProtocolMetadata:
    """Metadatos de la sesión para análisis posterior."""
    name: str = ""
    notes: str = ""
    time_of_day: str = ""
    sleep_quality: int = 0
    caffeine: bool = False
    prior_meditation_min: int = 0
    subjective_pre: int = 0
    subjective_post: int = 0


class ValidationProtocol:
    """
    Motor del protocolo de validación científica.

    Controla el timing de fases, agrega marcadores al recorder,
    y expone el estado actual para que el frontend lo renderice.
    """

    def __init__(self, recorder=None):
        self.recorder = recorder
        self.phases = VALIDATION_PHASES

        self.is_running = False
        self.is_paused = False
        self.current_phase_idx = 0
        self.phase_start_time: float = 0
        self.pause_offset: float = 0
        self.pause_start: float = 0
        self.protocol_start_time: float = 0
        self.metadata: Optional[ProtocolMetadata] = None

        self._events: List[Dict[str, Any]] = []
        self._logs_dir = Path(__file__).parent.parent / "validation_logs"
        self._logs_dir.mkdir(exist_ok=True)

    @property
    def current_phase(self) -> Optional[ProtocolPhase]:
        if 0 <= self.current_phase_idx < len(self.phases):
            return self.phases[self.current_phase_idx]
        return None

    @property
    def total_duration(self) -> int:
        return sum(p.duration for p in self.phases)

    def start(self, name: str = "", metadata: Optional[Dict] = None):
        """Inicia el protocolo de validación."""
        if self.is_running:
            return {"status": "error", "message": "Protocol already running"}

        self.is_running = True
        self.is_paused = False
        self.current_phase_idx = 0
        self.protocol_start_time = time.time()
        self.phase_start_time = time.time()
        self.pause_offset = 0
        self._events = []

        self.metadata = ProtocolMetadata(
            name=name or f"Validación {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            **(metadata or {})
        )

        if self.recorder:
            try:
                self.recorder.start(self.metadata.name)
            except Exception as e:
                print(f"⚠️ [ValidationProtocol] Recorder start failed: {e}")

        self._log_event("protocol_start", {
            "name": self.metadata.name,
            "total_phases": len(self.phases),
            "total_duration": self.total_duration,
        })
        self._add_marker("protocol_start")
        self._start_current_phase()

        print(f"🧪 [ValidationProtocol] Started: {self.metadata.name}")
        return {"status": "success", "message": "Protocol started"}

    def stop(self) -> Dict:
        """Detiene el protocolo y guarda el log."""
        if not self.is_running:
            return {"status": "error", "message": "Protocol not running"}

        self.is_running = False
        self._add_marker("protocol_end")
        self._log_event("protocol_stop", {
            "completed_phases": self.current_phase_idx,
            "total_phases": len(self.phases),
            "total_elapsed": time.time() - self.protocol_start_time,
        })

        if self.recorder:
            try:
                self.recorder.stop()
            except Exception as e:
                print(f"⚠️ [ValidationProtocol] Recorder stop failed: {e}")

        log_path = self._save_log()
        print(f"🧪 [ValidationProtocol] Stopped. Log: {log_path}")
        return {
            "status": "success",
            "completed_phases": self.current_phase_idx,
            "log_path": log_path,
        }

    def pause(self):
        if self.is_running and not self.is_paused:
            self.is_paused = True
            self.pause_start = time.time()
            self._log_event("protocol_pause", {"phase": self.current_phase.name if self.current_phase else None})

    def resume(self):
        if self.is_running and self.is_paused:
            self.is_paused = False
            self.pause_offset += time.time() - self.pause_start
            self._log_event("protocol_resume", {"phase": self.current_phase.name if self.current_phase else None})

    def advance_phase(self) -> Dict:
        """Avanza manualmente a la siguiente fase."""
        if not self.is_running:
            return {"status": "error", "message": "Protocol not running"}

        phase = self.current_phase
        if phase:
            self._add_marker(f"{phase.name}_end")
            self._log_event("phase_end", {
                "phase": phase.name,
                "elapsed": self._phase_elapsed(),
                "expected_duration": phase.duration,
                "skipped": self._phase_elapsed() < phase.duration * 0.8,
            })

        self.current_phase_idx += 1
        if self.current_phase_idx >= len(self.phases):
            return self.stop()

        self._start_current_phase()
        return self.get_state()

    def go_back_phase(self) -> Dict:
        """Retrocede a la fase anterior."""
        if not self.is_running or self.current_phase_idx <= 0:
            return {"status": "error", "message": "Cannot go back"}

        self.current_phase_idx -= 1
        self._start_current_phase()
        return self.get_state()

    def get_state(self) -> Dict:
        """
        Estado actual para el frontend.
        El frontend pollea cada ~500ms.
        """
        if not self.is_running:
            return {
                "status": "idle",
                "is_running": False,
                "phases": [asdict(p) for p in self.phases],
            }

        phase = self.current_phase
        if phase is None:
            return {"status": "complete", "is_running": False}

        elapsed = self._phase_elapsed()
        remaining = max(0, phase.duration - elapsed)

        # Auto-advance
        auto_advanced = False
        if remaining <= 0 and not self.is_paused:
            # Marcar fin antes de avanzar
            self._add_marker(f"{phase.name}_end")
            self._log_event("phase_end", {
                "phase": phase.name,
                "elapsed": elapsed,
                "expected_duration": phase.duration,
                "auto_advanced": True,
            })

            self.current_phase_idx += 1
            if self.current_phase_idx >= len(self.phases):
                self.stop()
                return {"status": "complete", "is_running": False}
            self._start_current_phase()
            phase = self.current_phase
            elapsed = 0
            remaining = phase.duration
            auto_advanced = True

        total_elapsed = time.time() - self.protocol_start_time - self.pause_offset

        return {
            "status": "recording",
            "is_running": True,
            "is_paused": self.is_paused,

            "phase_index": self.current_phase_idx,
            "total_phases": len(self.phases),
            "phase": asdict(phase),

            "phase_elapsed": round(elapsed, 1),
            "phase_remaining": round(remaining, 1),
            "phase_progress": round((elapsed / phase.duration) * 100, 1) if phase.duration > 0 else 100,

            "total_elapsed": round(total_elapsed, 1),
            "total_remaining": round(max(0, self.total_duration - total_elapsed), 1),
            "total_progress": round(min(100, (total_elapsed / self.total_duration) * 100), 1),

            "auto_advanced": auto_advanced,
            "tts_text": phase.tts_on_start if auto_advanced or elapsed < 1 else None,
        }

    def set_post_metadata(self, subjective_post: int):
        if self.metadata:
            self.metadata.subjective_post = subjective_post

    # ── Internal ────────────────────────────────────────────────────────

    def _phase_elapsed(self) -> float:
        if self.is_paused:
            return self.pause_start - self.phase_start_time - self.pause_offset
        return time.time() - self.phase_start_time - self.pause_offset

    def _start_current_phase(self):
        phase = self.current_phase
        if phase is None:
            return
        self.phase_start_time = time.time()
        self.pause_offset = 0

        self._add_marker(f"{phase.name}_start")
        self._log_event("phase_start", {
            "phase": phase.name,
            "label": phase.label,
            "duration": phase.duration,
            "instruction": phase.instruction,
        })
        print(f"📍 [ValidationProtocol] Phase {self.current_phase_idx + 1}/{len(self.phases)}: {phase.label} — {phase.instruction} ({phase.duration}s)")

    def _add_marker(self, label: str):
        if self.recorder:
            try:
                self.recorder.add_marker(label)
            except Exception as e:
                print(f"⚠️ [ValidationProtocol] Marker failed: {e}")

    def _log_event(self, event_type: str, data: Dict = None):
        self._events.append({
            "time": time.time(),
            "time_iso": datetime.now().isoformat(),
            "elapsed": time.time() - self.protocol_start_time if self.protocol_start_time else 0,
            "event": event_type,
            "data": data or {},
        })

    def _save_log(self) -> str:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        phases_completed = self.current_phase_idx
        label = "COMPLETE" if phases_completed >= len(self.phases) else f"PARTIAL_{phases_completed}"
        filename = self._logs_dir / f"validation_{ts}_{label}.json"

        payload = {
            "metadata": asdict(self.metadata) if self.metadata else None,
            "protocol_start": self.protocol_start_time,
            "protocol_start_iso": datetime.fromtimestamp(self.protocol_start_time).isoformat() if self.protocol_start_time else None,
            "phases_completed": phases_completed,
            "total_phases": len(self.phases),
            "total_events": len(self._events),
            "events": self._events,
        }

        with open(filename, "w") as f:
            json.dump(payload, f, indent=2, default=str)
        print(f"📁 [ValidationProtocol] Log saved: {filename}")
        return str(filename)
