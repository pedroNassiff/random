"""
Playlist Manager: Gestiona múltiples sesiones EEG para reproducción secuencial.

Permite crear playlists de datasets y reproducirlas automáticamente.
"""

import os
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
    """
    
    def __init__(self):
        self.sessions: List[Dict] = []
        self.current_index: int = 0
        self.current_player: Optional[SessionPlayer] = None
        self.loop_playlist: bool = True
        self.shuffle: bool = False
        
        # Cargar sesiones disponibles
        self._discover_sessions()
    
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
        
        print(f"✓ Playlist: Discovered {len(self.sessions)} sessions")
    
    def get_playlist(self) -> List[Dict]:
        """
        Retorna lista de sesiones disponibles con metadata.
        """
        playlist = []
        for idx, session in enumerate(self.sessions):
            playlist.append({
                'index': idx,
                'name': session['name'],
                'type': session['type'],
                'category': session['category'],
                'is_current': idx == self.current_index
            })
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
