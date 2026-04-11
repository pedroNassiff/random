"""
Analyze recorded EEG sessions from InfluxDB.

Usage:
    python analyze_sesion.py          # analyze latest session
    python analyze_sesion.py 33       # analyze specific session
"""
import sys
import importlib.util, os
import statistics
from collections import Counter

# Import influx_client directly — avoids database/__init__.py pulling in asyncpg/postgres
_spec = importlib.util.spec_from_file_location(
    "influx_client",
    os.path.join(os.path.dirname(__file__), "database", "influx_client.py")
)
_mod = importlib.util.module_from_spec(_spec)

# Load .env so INFLUXDB_* vars are available
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

_spec.loader.exec_module(_mod)

INFLUX_ORG = _mod.INFLUX_ORG
INFLUX_URL = _mod.INFLUX_URL
INFLUX_TOKEN = _mod.INFLUX_TOKEN
INFLUX_BUCKET = _mod.INFLUX_BUCKET

from influxdb_client import InfluxDBClient as _InfluxClient
_raw = _InfluxClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
qapi = _raw.query_api()

# ── Determine recording ID ──────────────────────────────────────────────
RECORDING_ID = sys.argv[1] if len(sys.argv) > 1 else None

if RECORDING_ID is None:
    # Find latest recording_id with data
    discover_q = f'''
    from(bucket: "{INFLUX_BUCKET}")
        |> range(start: -30d)
        |> filter(fn: (r) => r._measurement == "eeg_metrics")
        |> filter(fn: (r) => r._field == "coherence")
        |> group(columns: ["recording_id"])
        |> count()
        |> group()
        |> sort(columns: ["recording_id"], desc: true)
        |> limit(n: 10)
    '''
    try:
        tables = qapi.query(discover_q, org=INFLUX_ORG)
        found = []
        for t in tables:
            for r in t.records:
                rid = r.values.get("recording_id", "?")
                cnt = r.get_value()
                found.append((rid, cnt))
        if found:
            print("Available recordings in InfluxDB:")
            for rid, cnt in found:
                print(f"  #{rid}: {cnt} metric snapshots (~{cnt/5:.0f}s)")
            RECORDING_ID = found[0][0]
            print(f"\n→ Analyzing latest: #{RECORDING_ID}\n")
        else:
            print("No recordings found in InfluxDB.")
            sys.exit(1)
    except Exception as e:
        print(f"Error discovering recordings: {e}")
        sys.exit(1)

# ── Query metrics ────────────────────────────────────────────────────────
query = (
    f'from(bucket: "{INFLUX_BUCKET}") '
    f'|> range(start: -30d) '
    f'|> filter(fn: (r) => r["recording_id"] == "{RECORDING_ID}") '
    f'|> filter(fn: (r) => r._measurement == "eeg_metrics") '
    f'|> filter(fn: (r) => r._field != "blink_contaminated") '
    f'|> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value") '
    f'|> sort(columns: ["_time"])'
)

try:
    tables = qapi.query(query, org=INFLUX_ORG)
    rows = []
    for table in tables:
        for record in table.records:
            rows.append(record.values)
    
    if not rows:
        print(f"No metric data found for recording_id={RECORDING_ID}.")
        sys.exit(1)
    
    # ── Also count raw EEG samples ───────────────────────────────────
    sample_q = (
        f'from(bucket: "{INFLUX_BUCKET}") '
        f'|> range(start: -30d) '
        f'|> filter(fn: (r) => r["recording_id"] == "{RECORDING_ID}") '
        f'|> filter(fn: (r) => r._measurement == "eeg_sample") '
        f'|> filter(fn: (r) => r._field == "tp9") '
        f'|> count()'
    )
    sample_count = 0
    try:
        st = qapi.query(sample_q, org=INFLUX_ORG)
        for t in st:
            for r in t.records:
                sample_count = int(r.get_value())
    except:
        pass

    # ── Extract fields ───────────────────────────────────────────────
    def extract(field):
        return [r[field] for r in rows if r.get(field) is not None]
    
    coh = extract('coherence')
    alpha = extract('alpha')
    theta = extract('theta')
    beta = extract('beta')
    delta = extract('delta')
    gamma = extract('gamma')
    sq = extract('signal_quality')
    states = extract('state')
    freq = extract('dominant_frequency')
    entropy = extract('entropy')
    plv = extract('plv')
    alpha_raw = extract('alpha_raw')
    theta_raw = extract('theta_raw')
    beta_raw = extract('beta_raw')

    def stats(name, vals):
        if not vals: return
        if len(vals) == 1:
            print(f"  {name}: value={vals[0]:.4f} (single sample)")
            return
        print(f"  {name}: mean={statistics.mean(vals):.4f}  median={statistics.median(vals):.4f}  min={min(vals):.4f}  max={max(vals):.4f}  std={statistics.stdev(vals):.4f}")
    
    duration_s = len(rows) * 0.2  # 5Hz = 200ms per snapshot
    
    print(f"{'='*65}")
    print(f"  SESSION #{RECORDING_ID} ANALYSIS")
    print(f"{'='*65}")
    print(f"  Metric snapshots : {len(rows)} @ 5Hz = {duration_s:.0f}s ({duration_s/60:.1f} min)")
    print(f"  Raw EEG samples  : {sample_count} @ 256Hz = {sample_count/256:.0f}s ({sample_count/256/60:.1f} min)")
    if sample_count > 0 and duration_s > 0:
        expected_samples = int(duration_s * 256)
        completeness = sample_count / expected_samples * 100
        print(f"  Data completeness: {completeness:.1f}% ({sample_count}/{expected_samples} expected)")
    
    # ── Coherence ────────────────────────────────────────────────────
    print(f"\n{'─'*65}")
    print("  COHERENCE")
    print(f"{'─'*65}")
    stats("coherence", coh)
    buckets = {"<0.3":0, "0.3-0.5":0, "0.5-0.7":0, "0.7-0.9":0, ">0.9":0}
    for v in coh:
        if v < 0.3: buckets["<0.3"] += 1
        elif v < 0.5: buckets["0.3-0.5"] += 1
        elif v < 0.7: buckets["0.5-0.7"] += 1
        elif v < 0.9: buckets["0.7-0.9"] += 1
        else: buckets[">0.9"] += 1
    total = len(coh) or 1
    for k, n in buckets.items():
        bar = "█" * int(n/total*40)
        print(f"    {k:10s}: {n:4d} ({n/total*100:.1f}%) {bar}")
    
    # ── Bands (normalized 0-1) ───────────────────────────────────────
    print(f"\n{'─'*65}")
    print("  BANDS (normalized 0-1, relative power)")
    print(f"{'─'*65}")
    stats("alpha", alpha)
    stats("theta", theta)
    stats("beta", beta)
    stats("delta", delta)
    stats("gamma", gamma)
    
    # ── Bands RAW (µV²) ─────────────────────────────────────────────
    if alpha_raw:
        print(f"\n{'─'*65}")
        print("  BANDS RAW (µV² absolute power)")
        print(f"{'─'*65}")
        stats("alpha_raw", alpha_raw)
        stats("theta_raw", theta_raw)
        stats("beta_raw", beta_raw)
    
    # ── Signal Quality ───────────────────────────────────────────────
    print(f"\n{'─'*65}")
    print("  SIGNAL QUALITY")
    print(f"{'─'*65}")
    stats("avgSQ", sq)
    if sq:
        sq_good = sum(1 for v in sq if v >= 0.7)
        sq_ok = sum(1 for v in sq if 0.4 <= v < 0.7)
        sq_bad = sum(1 for v in sq if v < 0.4)
        print(f"  ≥0.7 (good) : {sq_good:4d} ({sq_good/total*100:.1f}%)")
        print(f"  0.4-0.7 (ok): {sq_ok:4d} ({sq_ok/total*100:.1f}%)")
        print(f"  <0.4 (bad)  : {sq_bad:4d} ({sq_bad/total*100:.1f}%)")
    
    # ── Entropy & PLV ────────────────────────────────────────────────
    print(f"\n{'─'*65}")
    print("  ENTROPY & PLV")
    print(f"{'─'*65}")
    stats("entropy", entropy)
    stats("plv", plv)
    stats("dominant_freq", freq)

    # ── Blink contamination ──────────────────────────────────────────
    blink_q = (
        f'from(bucket: "{INFLUX_BUCKET}") '
        f'|> range(start: -30d) '
        f'|> filter(fn: (r) => r["recording_id"] == "{RECORDING_ID}") '
        f'|> filter(fn: (r) => r._measurement == "eeg_metrics") '
        f'|> filter(fn: (r) => r._field == "blink_contaminated")'
    )
    try:
        blink_tables = qapi.query(blink_q, org=INFLUX_ORG)
        blink_vals = [rec.get_value() for t in blink_tables for rec in t.records]
        n_blinks = sum(1 for v in blink_vals if v)
        print(f"\n{'─'*65}")
        print("  BLINK CONTAMINATION (EOG)")
        print(f"{'─'*65}")
        if blink_vals:
            print(f"  Total windows    : {len(blink_vals)}")
            print(f"  Contaminated     : {n_blinks} ({n_blinks/len(blink_vals)*100:.1f}%)")
            print(f"  Clean            : {len(blink_vals)-n_blinks} ({(len(blink_vals)-n_blinks)/len(blink_vals)*100:.1f}%)")
        else:
            print("  No blink_contaminated data found")
    except Exception as be:
        print(f"  (blink query skipped: {be})")

    # ── Brain States ─────────────────────────────────────────────────
    print(f"\n{'─'*65}")
    print("  BRAIN STATES")
    print(f"{'─'*65}")
    if states:
        state_counts = Counter(states)
        for state, count in sorted(state_counts.items(), key=lambda x: -x[1]):
            pct = count/len(states)*100
            bar = "█" * int(pct/2.5)
            print(f"  {state:25s}: {count:4d} ({pct:.1f}%) {bar}")
    
    # ── Time evolution (5 segments) ──────────────────────────────────
    print(f"\n{'─'*65}")
    print("  TIME EVOLUTION")
    print(f"{'─'*65}")
    n = len(rows)
    n_segments = min(5, max(2, n // 50))  # 2-5 segments
    seg_size = n // n_segments
    for i in range(n_segments):
        start_idx = i * seg_size
        end_idx = (i + 1) * seg_size if i < n_segments - 1 else n
        subset = rows[start_idx:end_idx]
        t_start = start_idx * 0.2
        t_end = end_idx * 0.2
        
        c = [r['coherence'] for r in subset if r.get('coherence') is not None]
        a = [r['alpha'] for r in subset if r.get('alpha') is not None]
        ar = [r['alpha_raw'] for r in subset if r.get('alpha_raw') is not None]
        s = [r['state'] for r in subset if r.get('state') is not None]
        top_state = Counter(s).most_common(1)[0][0] if s else "?"
        
        alpha_str = f"alpha_raw={statistics.mean(ar):.1f}µV²" if ar else f"alpha_norm={statistics.mean(a):.4f}"
        print(f"  {t_start:5.0f}-{t_end:5.0f}s: coh={statistics.mean(c):.3f}  {alpha_str}  state={top_state}")

    # ── Overall verdict ──────────────────────────────────────────────
    print(f"\n{'='*65}")
    print("  VERDICT")
    print(f"{'='*65}")
    
    issues = []
    if sq:
        sq_mean = statistics.mean(sq)
        if sq_mean < 0.5:
            issues.append(f"⚠️  Low signal quality (mean={sq_mean:.2f})")
    
    if coh:
        coh_mean = statistics.mean(coh)
        if coh_mean < 0.3:
            issues.append(f"⚠️  Very low coherence (mean={coh_mean:.2f})")
    
    if sample_count > 0 and duration_s > 0:
        completeness = sample_count / (duration_s * 256) * 100
        if completeness < 80:
            issues.append(f"⚠️  Data gaps ({completeness:.0f}% complete)")
    
    if duration_s < 30:
        issues.append(f"⚠️  Very short session ({duration_s:.0f}s)")
    
    if not issues:
        print("  ✅ Session looks good — data is usable for analysis")
    else:
        for issue in issues:
            print(f"  {issue}")
        print("  → Data may still be partially usable, check specifics above")

except Exception as e:
    print(f"Error: {e}")
    import traceback; traceback.print_exc()
