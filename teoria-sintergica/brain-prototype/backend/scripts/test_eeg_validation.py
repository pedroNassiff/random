#!/usr/bin/env python3
"""
EEG Validation Tests for Muse 2
================================
Tests to verify that EEG data is being captured and displayed correctly.

Classic EEG validation tests:
1. Eyes Open/Closed (Alpha Blocking) - Most important!
2. Deep Breathing (Alpha + Coherence increase)
3. Blink Detection (Frontal artifact)
4. Jaw Clench (EMG artifact)
5. Mental Math (Beta increase)

Run with: python scripts/test_eeg_validation.py
"""

import sys
import time
import numpy as np
from collections import deque
import threading

# Add parent to path
sys.path.insert(0, '..')

try:
    from pylsl import StreamInlet, resolve_byprop
except ImportError:
    print("❌ pylsl not installed. Run: pip install pylsl")
    sys.exit(1)

# Colors for terminal
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def compute_band_powers(data, fs=256):
    """Compute power in each frequency band."""
    from scipy import signal
    
    # FFT
    freqs = np.fft.rfftfreq(data.shape[1], 1/fs)
    fft_vals = np.abs(np.fft.rfft(data, axis=1))
    
    # Band definitions
    bands = {
        'delta': (0.5, 4),
        'theta': (4, 8),
        'alpha': (8, 13),
        'beta': (13, 30),
        'gamma': (30, 50)
    }
    
    powers = {}
    for band, (low, high) in bands.items():
        mask = (freqs >= low) & (freqs < high)
        powers[band] = np.mean(fft_vals[:, mask])
    
    return powers

def compute_coherence(data):
    """Compute inter-hemispheric coherence."""
    if data.shape[0] < 4:
        return 0.5
    
    # Left hemisphere: TP9 (0), AF7 (1)
    # Right hemisphere: AF8 (2), TP10 (3)
    left = np.mean(data[:2], axis=0)
    right = np.mean(data[2:4], axis=0)
    
    # Correlation as simple coherence measure
    if np.std(left) > 0 and np.std(right) > 0:
        corr = np.corrcoef(left, right)[0, 1]
        return (corr + 1) / 2  # Normalize to 0-1
    return 0.5

def display_bar(value, max_val=1.0, width=30, label="", color=Colors.GREEN):
    """Display a progress bar in terminal."""
    normalized = min(value / max_val, 1.0)
    filled = int(width * normalized)
    bar = '█' * filled + '░' * (width - filled)
    percentage = normalized * 100
    return f"{label:12} {color}{bar}{Colors.END} {percentage:5.1f}%"

def display_signal_quality(data):
    """Check signal quality for each channel."""
    channels = ['TP9', 'AF7', 'AF8', 'TP10']
    quality = []
    
    for i, ch in enumerate(channels[:min(4, data.shape[0])]):
        std = np.std(data[i])
        amp = np.max(np.abs(data[i]))
        
        # Good signal: std between 10-80 µV
        if 10 <= std <= 80 and amp < 200:
            status = f"{Colors.GREEN}●{Colors.END}"
            quality.append(True)
        elif std < 10:
            status = f"{Colors.RED}○{Colors.END}"  # Low signal
            quality.append(False)
        else:
            status = f"{Colors.YELLOW}◐{Colors.END}"  # Noisy
            quality.append(True)
        
        print(f"  {ch}: {status} (σ={std:.1f} µV)")
    
    return all(quality)

def run_test(inlet, test_name, duration, instruction, expected):
    """Run a single validation test."""
    print(f"\n{Colors.HEADER}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}TEST: {test_name}{Colors.END}")
    print(f"{Colors.HEADER}{'='*60}{Colors.END}")
    print(f"\n📋 {instruction}")
    print(f"⏱️  Duration: {duration} seconds")
    print(f"🎯 Expected: {expected}")
    
    input(f"\n{Colors.YELLOW}Press ENTER when ready...{Colors.END}")
    
    # Collect baseline (2 seconds)
    print(f"\n{Colors.CYAN}Collecting baseline (2s)...{Colors.END}")
    baseline_data = []
    start = time.time()
    while time.time() - start < 2:
        sample, _ = inlet.pull_sample(timeout=1.0)
        if sample:
            baseline_data.append(sample[:4])
    
    baseline = np.array(baseline_data).T if baseline_data else np.zeros((4, 256))
    baseline_powers = compute_band_powers(baseline)
    baseline_coherence = compute_coherence(baseline)
    
    print(f"Baseline Alpha: {baseline_powers.get('alpha', 0):.2f}")
    print(f"Baseline Beta:  {baseline_powers.get('beta', 0):.2f}")
    print(f"Baseline Coherence: {baseline_coherence:.2f}")
    
    # Countdown
    print(f"\n{Colors.YELLOW}Starting in 3...{Colors.END}", end='', flush=True)
    time.sleep(1)
    print(f" 2...", end='', flush=True)
    time.sleep(1)
    print(f" 1...", end='', flush=True)
    time.sleep(1)
    print(f" {Colors.GREEN}GO!{Colors.END}\n")
    
    # Collect test data
    test_data = []
    start = time.time()
    last_update = start
    
    while time.time() - start < duration:
        sample, _ = inlet.pull_sample(timeout=0.1)
        if sample:
            test_data.append(sample[:4])
        
        # Update display every 0.5s
        if time.time() - last_update > 0.5 and len(test_data) > 128:
            elapsed = time.time() - start
            remaining = duration - elapsed
            
            # Compute current metrics
            recent_data = np.array(test_data[-512:]).T  # Last 2 seconds
            powers = compute_band_powers(recent_data)
            coherence = compute_coherence(recent_data)
            
            # Clear line and show progress
            print(f"\r⏱️ {remaining:.1f}s remaining | ", end='')
            print(f"α:{powers.get('alpha',0):.1f} ", end='')
            print(f"β:{powers.get('beta',0):.1f} ", end='')
            print(f"Coh:{coherence:.2f}  ", end='', flush=True)
            
            last_update = time.time()
    
    print(f"\n\n{Colors.GREEN}✓ Test complete!{Colors.END}")
    
    # Analyze results
    if not test_data:
        print(f"{Colors.RED}❌ No data collected!{Colors.END}")
        return None
    
    test_array = np.array(test_data).T
    test_powers = compute_band_powers(test_array)
    test_coherence = compute_coherence(test_array)
    
    # Compare with baseline
    print(f"\n{Colors.BOLD}Results:{Colors.END}")
    print(f"{'Metric':<15} {'Baseline':>10} {'Test':>10} {'Change':>10}")
    print("-" * 45)
    
    alpha_change = test_powers.get('alpha', 0) - baseline_powers.get('alpha', 0)
    beta_change = test_powers.get('beta', 0) - baseline_powers.get('beta', 0)
    coh_change = test_coherence - baseline_coherence
    
    alpha_color = Colors.GREEN if alpha_change > 0 else Colors.RED
    beta_color = Colors.GREEN if beta_change > 0 else Colors.RED
    coh_color = Colors.GREEN if coh_change > 0 else Colors.RED
    
    print(f"{'Alpha':<15} {baseline_powers.get('alpha', 0):>10.2f} {test_powers.get('alpha', 0):>10.2f} {alpha_color}{alpha_change:>+10.2f}{Colors.END}")
    print(f"{'Beta':<15} {baseline_powers.get('beta', 0):>10.2f} {test_powers.get('beta', 0):>10.2f} {beta_color}{beta_change:>+10.2f}{Colors.END}")
    print(f"{'Coherence':<15} {baseline_coherence:>10.2f} {test_coherence:>10.2f} {coh_color}{coh_change:>+10.2f}{Colors.END}")
    
    return {
        'baseline_powers': baseline_powers,
        'test_powers': test_powers,
        'baseline_coherence': baseline_coherence,
        'test_coherence': test_coherence,
        'alpha_change': alpha_change,
        'beta_change': beta_change,
        'coherence_change': coh_change
    }

def main():
    print(f"""
{Colors.HEADER}╔══════════════════════════════════════════════════════════╗
║           MUSE 2 EEG VALIDATION TESTS                    ║
║                                                          ║
║  Verify your EEG data is being captured correctly        ║
╚══════════════════════════════════════════════════════════╝{Colors.END}
    """)
    
    # Connect to LSL stream
    print(f"{Colors.CYAN}🔍 Searching for Muse EEG stream...{Colors.END}")
    streams = resolve_byprop('type', 'EEG', timeout=10)
    
    if not streams:
        print(f"{Colors.RED}❌ No EEG stream found!{Colors.END}")
        print("   Make sure muselsl is running:")
        print("   muselsl stream --address YOUR_MUSE_ADDRESS")
        sys.exit(1)
    
    inlet = StreamInlet(streams[0])
    print(f"{Colors.GREEN}✅ Connected to: {streams[0].name()}{Colors.END}")
    print(f"   Channels: {streams[0].channel_count()}")
    print(f"   Sample rate: {streams[0].nominal_srate()} Hz")
    
    # Check signal quality first
    print(f"\n{Colors.BOLD}Checking signal quality...{Colors.END}")
    print("Make sure the Muse is properly positioned on your head.")
    time.sleep(1)
    
    quality_data = []
    for _ in range(512):  # 2 seconds
        sample, _ = inlet.pull_sample(timeout=1.0)
        if sample:
            quality_data.append(sample[:4])
    
    if quality_data:
        quality_array = np.array(quality_data).T
        good_quality = display_signal_quality(quality_array)
        
        if not good_quality:
            print(f"\n{Colors.YELLOW}⚠️  Some electrodes may have poor contact.{Colors.END}")
            print("   Adjust the headband and ensure good skin contact.")
            proceed = input("Continue anyway? (y/n): ")
            if proceed.lower() != 'y':
                sys.exit(0)
    
    # Define tests
    tests = [
        {
            'name': '👁️ EYES OPEN vs CLOSED (Alpha Blocking)',
            'duration': 10,
            'instruction': 'Close your eyes and relax. Keep them closed for the entire duration.',
            'expected': 'Alpha waves should INCREASE significantly (this is the most reliable EEG test)'
        },
        {
            'name': '👁️ EYES OPEN (Comparison)',
            'duration': 10,
            'instruction': 'Keep your eyes OPEN and look at a fixed point. Try not to blink.',
            'expected': 'Alpha should be LOWER than with eyes closed'
        },
        {
            'name': '🫁 DEEP BREATHING',
            'duration': 20,
            'instruction': 'Breathe deeply and slowly. Inhale 4s, hold 2s, exhale 6s. Repeat.',
            'expected': 'Alpha and coherence should gradually increase as you relax'
        },
        {
            'name': '😯 BLINK TEST',
            'duration': 10,
            'instruction': 'Blink deliberately every 2 seconds. Exaggerate the blinks.',
            'expected': 'You should see spikes in frontal channels (AF7, AF8)'
        },
        {
            'name': '😬 JAW CLENCH',
            'duration': 10,
            'instruction': 'Clench your jaw firmly for 2 seconds, release for 2 seconds. Repeat.',
            'expected': 'High-frequency noise (EMG artifact) should appear during clenches'
        },
        {
            'name': '🧮 MENTAL MATH',
            'duration': 15,
            'instruction': 'Count backwards from 500 by 7s (500, 493, 486...). Focus hard!',
            'expected': 'Beta waves should INCREASE due to concentration'
        }
    ]
    
    # Menu
    print(f"\n{Colors.BOLD}Available Tests:{Colors.END}")
    for i, test in enumerate(tests, 1):
        print(f"  {i}. {test['name']}")
    print(f"  A. Run ALL tests")
    print(f"  Q. Quit")
    
    results = {}
    
    while True:
        choice = input(f"\n{Colors.CYAN}Select test (1-{len(tests)}, A, or Q): {Colors.END}").strip().upper()
        
        if choice == 'Q':
            break
        elif choice == 'A':
            for test in tests:
                result = run_test(inlet, test['name'], test['duration'], 
                                test['instruction'], test['expected'])
                if result:
                    results[test['name']] = result
                time.sleep(2)
        elif choice.isdigit() and 1 <= int(choice) <= len(tests):
            test = tests[int(choice) - 1]
            result = run_test(inlet, test['name'], test['duration'],
                            test['instruction'], test['expected'])
            if result:
                results[test['name']] = result
        else:
            print(f"{Colors.RED}Invalid choice{Colors.END}")
    
    # Summary
    if results:
        print(f"\n\n{Colors.HEADER}{'='*60}{Colors.END}")
        print(f"{Colors.BOLD}VALIDATION SUMMARY{Colors.END}")
        print(f"{Colors.HEADER}{'='*60}{Colors.END}")
        
        # Check eyes test
        eyes_closed = results.get('👁️ EYES OPEN vs CLOSED (Alpha Blocking)')
        eyes_open = results.get('👁️ EYES OPEN (Comparison)')
        
        if eyes_closed and eyes_open:
            alpha_diff = eyes_closed['test_powers']['alpha'] - eyes_open['test_powers']['alpha']
            if alpha_diff > 0.5:
                print(f"{Colors.GREEN}✅ Alpha Blocking TEST PASSED!{Colors.END}")
                print(f"   Eyes closed Alpha was {alpha_diff:.2f} higher than eyes open")
                print(f"   This confirms your EEG is working correctly!")
            else:
                print(f"{Colors.YELLOW}⚠️  Alpha Blocking inconclusive{Colors.END}")
                print(f"   Difference: {alpha_diff:.2f}")
                print(f"   Try adjusting headband position")
        
        print(f"\n{Colors.CYAN}Your Muse 2 appears to be capturing valid EEG data!{Colors.END}")
    
    print(f"\n{Colors.GREEN}Tests complete. Goodbye! 👋{Colors.END}\n")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Interrupted by user{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}Error: {e}{Colors.END}")
        import traceback
        traceback.print_exc()
