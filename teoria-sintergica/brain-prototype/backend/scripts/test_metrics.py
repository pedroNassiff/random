"""Test script to verify metrics are loaded correctly."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai.playlist_manager import PlaylistManager
from ai.session_player import SessionPlayer

pm = PlaylistManager()

# Cargar sesión test 7 (index 3)
player = pm.load_session(3)

print()
print("=== Session loaded ===")
print(f"Has metrics: {hasattr(player, '_recorded_metrics')}")

if hasattr(player, '_recorded_metrics'):
    print(f"Num metrics: {len(player._recorded_metrics)}")
    if player._recorded_metrics:
        print(f"First metric keys: {player._recorded_metrics[0].keys()}")
        print(f"First relative_time: {player._recorded_metrics[0].get('relative_time')}")
        print()
        
        # Test getting metrics at position
        m = player._get_metrics_at_position(0.0)
        print(f"Metric at 0.0s: {m is not None}")
        if m:
            print(f"  alpha={m.get('alpha')}, coherence={m.get('coherence')}")
        
        m = player._get_metrics_at_position(1.0)
        print(f"Metric at 1.0s: {m is not None}")
        if m:
            print(f"  alpha={m.get('alpha')}, coherence={m.get('coherence')}")
            
        m = player._get_metrics_at_position(5.0)
        print(f"Metric at 5.0s: {m is not None}")
        if m:
            print(f"  alpha={m.get('alpha')}, coherence={m.get('coherence')}")
        
        print()
        print("=== Test next_window with recorded_metrics ===")
        player.play()
        for i in range(5):
            window = player.next_window()
            if window:
                has_metrics = window.get('recorded_metrics') is not None
                pos = window.get('timestamp', 0)
                print(f"Window {i}: pos={pos:.2f}s, has_recorded_metrics={has_metrics}")
                if has_metrics:
                    rm = window['recorded_metrics']
                    print(f"  -> alpha={rm.get('alpha')}, coherence={rm.get('coherence')}")
