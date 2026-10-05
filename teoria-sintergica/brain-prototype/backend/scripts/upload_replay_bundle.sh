#!/bin/bash
#
# upload_replay_bundle.sh — sube el replay bundle al bucket GCS de assets.
#
# Uso:
#   DRY_RUN=1 ./scripts/upload_replay_bundle.sh [bundle_dir]   # solo muestra qué cambiaría
#   ./scripts/upload_replay_bundle.sh [bundle_dir]
#
# Env:
#   BUCKET   bucket destino (default: random-507414-assets, ver infra/4-services/storage.tf)
#   PREFIX   prefijo dentro del bucket (default: replay) — debe coincidir con REPLAY_BUNDLE_URI
#
# ATENCIÓN: usa `rsync -d`, que BORRA del bucket lo que no exista en el bundle local.

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_DIR="${1:-$BACKEND_DIR/replay_bundle}"
BUCKET="${BUCKET:-random-507414-assets}"
PREFIX="${PREFIX:-replay}"

if [ ! -f "$BUNDLE_DIR/manifest.json" ]; then
  echo "✗ $BUNDLE_DIR/manifest.json no existe. Corré scripts/export_replay_bundle.py primero." >&2
  exit 1
fi

DEST="gs://$BUCKET/$PREFIX/"
FLAGS="-m rsync -r -d"
if [ "${DRY_RUN:-0}" = "1" ]; then
  FLAGS="$FLAGS -n"
  echo "DRY RUN — no se modifica el bucket"
fi

echo "→ $BUNDLE_DIR  ->  $DEST"
# shellcheck disable=SC2086
gsutil $FLAGS "$BUNDLE_DIR" "$DEST"
echo "✓ REPLAY_BUNDLE_URI=$DEST"
