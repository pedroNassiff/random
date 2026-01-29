"""
Playlist Manager: Gestiona múltiples sesiones EEG para reproducción secuencial.

Permite crear playlists de datasets y reproducirlas automáticamente.
Ahora también incluye sesiones grabadas desde PostgreSQL + InfluxDB.
"""

import os
import asyncio
from typing import List, Dict, Optional
from .session_player import SessionPlayer


class PlaylistManager:
    """
    Gestor de playlists para sesiones EEG.
    
    Características:
    - Reproducción secuencial de múltiples sesiones
    - Transición automática entre sesiones
    - Control de playlist (next, previous, shuffle)
    - Metadata de cada sesión
    - Integración con sesiones grabadas (PostgreSQL + InfluxDB)
    """
    
    def __init__(self):
        self.sessions: List[Dict] = []
        self.current_index: int = 0
        self.current_player: Optional[SessionPlayer] = None
        self.loop_playlist: bool = True
        self.shuffle: bool = False
        
        # Cargar sesiones disponibles
        self._discover_sessions()
        self._load_recorded_sessions()
    
    def _discover_sessions(self):
        """
        Descubre automáticamente sesiones EDF disponibles.
        """
        data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
        
        # Sesiones de meditación (OpenNeuro)
        meditation_path = os.path.join(data_path, 'meditation')
        if os.path.exists(meditation_path):
            for filename in os.listdir(meditation_path):
                if filename.endswith('.edf'):
                    self.sessions.append({
                        'name': filename.replace('.edf', '').replace('_', ' ').title(),
                        'path': os.path.join(meditation_path, filename),
                        'type': 'meditation',
                        'category': 'Meditation'
                    })
        
        # Sesiones de PhysioNet (múltiples runs concatenados)
        # Agregar manualmente sesiones pre-configuradas
        self.sessions.extend([
            {
                'name': 'PhysioNet - Eyes Closed (1 min)',
                'path': 'physionet_run2',  # ID especial
                'type': 'physionet',
                'category': 'Relaxation'
            },
            {
                'name': 'PhysioNet - Motor Imagery (6 min)',
                'path': 'physionet_runs_6-10-14',  # ID especial
                'type': 'physionet',
                'category': 'Focus'
            }
        ])
        
        print(f"✓ Playlist: Discovered {len(self.sessions)} dataset sessions")
    
    def _load_recorded_sessions(self):
        """
        Carga sesiones grabadas desde PostgreSQL (eeg_recordings table).
        """
        try:
            from database import get_postgres_client_sync
            postgres = get_postgres_client_sync()
            postgres.connect()
            recordings = postgres.get_all_recordings(limit=100)
            
            for rec in recordings:
                self.sessions.append({
                    'name': rec.name or f"Recording #{rec.id}",
                    'path': f"recorded:{rec.id}",  # ID especial para sesiones grabadas
                    'type': 'recorded',
                    'category': 'Mis Grabaciones',
                    'db_id': rec.id,
                    'duration': rec.duration_seconds,
                    'date': rec.started_at.isoformat() if rec.started_at else '',
                    'notes': rec.notes or '',
                    'sample_count': rec.sample_count,
                    'avg_alpha': rec.avg_alpha,
                    'avg_coherence': rec.avg_coherence
                })
            
            if recordings:
                print(f"✓ Playlist: Loaded {len(recordings)} recorded sessions from PostgreSQL")
        except Exception as e:
            print(f"⚠ Could not load recorded sessions from PostgreSQL: {e}")
            # Fallback to SQLite
            self._load_recorded_sessions_sqlite()
    
    def _load_recorded_sessions_sqlite(self):
        """
        Fallback: Carga sesiones desde SQLite (legacy).
        """
        try:
            from database import get_database
            db = get_database()
            recorded = db.list_sessions(limit=100)
            
            for session in recorded:
                self.sessions.append({
                    'name': session.get('name', f"Sesión #{session['id']}"),
                    'path': f"sqlite:{session['id']}",  # ID para sesiones SQLite legacy
                    'type': 'recorded_sqlite',
                    'category': 'Mis Grabaciones (Legacy)',
                    'db_id': session['id'],
                    'duration': session.get('duration_seconds', 0),
                    'date': session.get('start_time', ''),
                    'notes': session.get('notes', '')
                })
            
            if recorded:
                print(f"✓ Playlist: Loaded {len(recorded)} recorded sessions from SQLite (legacy)")
        except Exception as e:
            print(f"⚠ Could not load recorded sessions from SQLite: {e}")
    
    def refresh_recorded_sessions(self):
        """
        Recarga las sesiones grabadas desde PostgreSQL.
        Útil después de grabar una nueva sesión.
        """
        # Quitar sesiones grabadas existentes
        self.sessions = [s for s in self.sessions if s['type'] not in ['recorded', 'recorded_sqlite']]
        # Recargar
        self._load_recorded_sessions()
    
    def get_playlist(self) -> List[Dict]:
        """
        Retorna lista de sesiones disponibles con metadata.
        """
        playlist = []
        for idx, session in enumerate(self.sessions):
            item = {
                'index': idx,
                'name': session['name'],
                'type': session['type'],
                'category': session['category'],
                'is_current': idx == self.current_index
            }
            # Info adicional para sesiones grabadas
            if session['type'] in ['recorded', 'recorded_sqlite']:
                item['db_id'] = session.get('db_id')
                item['duration'] = session.get('duration', 0)
                item['date'] = session.get('date', '')
                item['notes'] = session.get('notes', '')
                item['sample_count'] = session.get('sample_count', 0)
                item['avg_alpha'] = session.get('avg_alpha')
                item['avg_coherence'] = session.get('avg_coherence')
            playlist.append(item)
        return playlist
    
    def load_session(self, index: int) -> SessionPlayer:
        """
        Carga sesión específica del playlist.
        
        Args:
            index: Índice de la sesión en playlist
            
        Returns:
            SessionPlayer configurado para esa sesión
        """
        if index < 0 or index >= len(self.sessions):
            print(f"⚠ Invalid session index: {index}")
            return None
        
        session = self.sessions[index]
        self.current_index = index
        
        print(f"📼 Loading session {index + 1}/{len(self.sessions)}: {session['name']}")
        
        # Crear nuevo player
        player = SessionPlayer(window_duration=2.0)
        
        # Cargar según tipo
        if session['type'] == 'meditation':
            # Archivo EDF directo
            player.load_session(session['path'])
        elif session['type'] == 'physionet':
            # Sesiones especiales de PhysioNet
            if session['path'] == 'physionet_run2':
                player.load_default_session()
            elif session['path'] == 'physionet_runs_6-10-14':
                player.load_physionet_extended()
        elif session['type'] == 'recorded':
            # Sesiones grabadas desde PostgreSQL + InfluxDB (nuevo)
            db_id = session.get('db_id')
            if db_id:
                player.load_recorded_session_v2(db_id)
        elif session['type'] == 'recorded_sqlite':
            # Sesiones grabadas desde SQLite (legacy)
            db_id = session.get('db_id')
            if db_id:
                player.load_recorded_session(db_id)
        
        self.current_player = player
        return player
    
    def next_session(self) -> Optional[SessionPlayer]:
        """
        Avanza a siguiente sesión en playlist.
        """
        next_index = self.current_index + 1
        
        # Loop o detener
        if next_index >= len(self.sessions):
            if self.loop_playlist:
                next_index = 0
                print("🔄 Playlist loop: Restarting from beginning")
            else:
                print("⏹ Playlist finished")
                return None
        
        return self.load_session(next_index)
    
    def previous_session(self) -> Optional[SessionPlayer]:
        """
        Retrocede a sesión anterior.
        """
        prev_index = self.current_index - 1
        
        if prev_index < 0:
            if self.loop_playlist:
                prev_index = len(self.sessions) - 1
            else:
                print("⏹ Already at first session")
                return None
        
        return self.load_session(prev_index)
    
    def get_current_session_info(self) -> Dict:
        """
        Retorna metadata de sesión actual.
        """
        if self.current_index < len(self.sessions):
            session = self.sessions[self.current_index]
            return {
                'name': session['name'],
                'index': self.current_index + 1,
                'total': len(self.sessions),
                'category': session['category'],
                'type': session['type']
            }
        return {}
    
    def should_auto_advance(self) -> bool:
        """
        Determina si debe avanzar automáticamente a siguiente sesión.
        Llamar cuando sesión actual termina.
        """
        if self.current_player is None:
            return False
        
        # Si llegamos al final de la sesión actual
        if self.current_player.current_position >= self.current_player.total_duration - 1.0:
            return True
        
        return False
    
    def add_custom_session(self, name: str, path: str, category: str = 'Custom'):
        """
        Agrega sesión personalizada al playlist.
        
        Args:
            name: Nombre descriptivo
            path: Ruta al archivo EDF
            category: Categoría (Meditation, Focus, Custom, etc)
        """
        if not os.path.exists(path):
            print(f"⚠ File not found: {path}")
            return False
        
        self.sessions.append({
            'name': name,
            'path': path,
            'type': 'custom',
            'category': category
        })
        
        print(f"✓ Added to playlist: {name}")
        return True
