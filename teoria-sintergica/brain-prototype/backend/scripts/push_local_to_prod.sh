#!/bin/bash
#
# push_local_to_prod.sh — sube a producción lo que tenés en local:
#   dashboard  datos fiscales de tu usuario (Postgres + documentos al bucket), vía fiscal.infrastructure.replicate
#   brain      grabaciones EEG y datasets como replay bundle (export_replay_bundle.py + upload_replay_bundle.sh)
#
# Uso (desde cualquier carpeta):
#   DRY_RUN=1 ./scripts/push_local_to_prod.sh            # todo, sin escribir nada en prod
#   ./scripts/push_local_to_prod.sh dashboard            # solo el dashboard
#   REPLACE=1 ./scripts/push_local_to_prod.sh dashboard  # pisa los datos que tu usuario ya tenga en prod
#   ./scripts/push_local_to_prod.sh brain                # solo brain (backend local levantado en $API)
#
# Env:
#   ACCOUNT     cuenta de gcloud con acceso al proyecto (default: signal@random-lab.es)
#   EMAIL       usuario del dashboard a replicar (default: signal@random-lab.es)
#   API         backend local para los snapshots de /lab/brain/doc (default: http://localhost:8000)
#   PROXY_PORT  puerto local del cloud-sql-proxy (default: 5434)
#
# Antes de escribir en la base aplica las migraciones pendientes de futbol y fiscal (con DRY_RUN solo las lista).

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND_DIR"
PY="$BACKEND_DIR/venv/bin/python"

PROJECT="random-507414"
INSTANCE="$PROJECT:us-central1:random-postgres"
ACCOUNT="${ACCOUNT:-signal@random-lab.es}"
EMAIL="${EMAIL:-signal@random-lab.es}"
API="${API:-http://localhost:8000}"
PROXY_PORT="${PROXY_PORT:-5434}"
DRY_RUN="${DRY_RUN:-0}"
REPLACE="${REPLACE:-0}"
WHAT="${1:-all}"

# ~/.zshrc exporta una impersonación de otro proyecto: se anula y se fija la cuenta y el proyecto.
unset GOOGLE_IMPERSONATE_SERVICE_ACCOUNT
export CLOUDSDK_CORE_ACCOUNT="$ACCOUNT" CLOUDSDK_CORE_PROJECT="$PROJECT"

step() { printf '\n\033[1;36m── %s\033[0m\n' "$1"; }
fail() { printf '\033[0;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

[ "$DRY_RUN" = "1" ] && echo "DRY RUN — no se escribe nada en producción"

PROXY_PID=""
cleanup() { [ -n "$PROXY_PID" ] && kill "$PROXY_PID" 2>/dev/null || true; }
trap cleanup EXIT

start_proxy() {
  cloud-sql-proxy --token "$TOKEN" --port "$PROXY_PORT" "$INSTANCE" >/tmp/push_local_to_prod.proxy.log 2>&1 &
  PROXY_PID=$!
  for _ in $(seq 30); do
    nc -z 127.0.0.1 "$PROXY_PORT" 2>/dev/null && return 0
    kill -0 "$PROXY_PID" 2>/dev/null || break
    sleep 0.5
  done
  fail "cloud-sql-proxy no levantó (ver /tmp/push_local_to_prod.proxy.log)"
}

# DSN del secreto de Cloud Run, apuntado al proxy local. Nunca se imprime.
prod_dsn() {
  gcloud secrets versions access latest --secret random-database-url | "$PY" -c '
import sys
from urllib.parse import urlsplit, urlunsplit
u = urlsplit(sys.stdin.read().strip())
userinfo = u.netloc.rpartition("@")[0]
print(urlunsplit((u.scheme, f"{userinfo}@127.0.0.1:{sys.argv[1]}", u.path, "", "")))
' "$PROXY_PORT"
}

push_dashboard() {
  step "dashboard: proxy a Cloud SQL"
  start_proxy
  DSN="$(prod_dsn)"

  for schema in futbol fiscal; do
    step "dashboard: migraciones de $schema"
    "$PY" -m futbol.infrastructure.migrate --schema "$schema" --dsn "$DSN" --dry-run
    [ "$DRY_RUN" = "1" ] || "$PY" -m futbol.infrastructure.migrate --schema "$schema" --dsn "$DSN"
  done

  step "dashboard: datos de $EMAIL"
  args=(--target-dsn "$DSN" --bucket "$PROJECT-fiscal-docs" --email "$EMAIL")
  [ "$DRY_RUN" = "1" ] && args+=(--dry-run)
  [ "$REPLACE" = "1" ] && args+=(--replace)
  GOOGLE_OAUTH_ACCESS_TOKEN="$TOKEN" GCP_PROJECT="$PROJECT" "$PY" -m fiscal.infrastructure.replicate "${args[@]}"
}

push_brain() {
  step "brain: export del replay bundle"
  curl -sf -o /dev/null "$API/" || fail "el backend local no responde en $API (levantalo: hace falta para /doc)"
  "$PY" scripts/export_replay_bundle.py --out replay_bundle --api "$API"

  step "brain: subida al bucket"
  DRY_RUN="$DRY_RUN" BUCKET="$PROJECT-assets" ./scripts/upload_replay_bundle.sh replay_bundle
  [ "$DRY_RUN" = "1" ] || echo "Las grabaciones nuevas aparecen cuando Cloud Run recicla la instancia (scale-to-zero) o con una revisión nueva."
}

TOKEN="$(gcloud auth print-access-token)" || fail "gcloud sin sesión para $ACCOUNT: gcloud auth login $ACCOUNT"

case "$WHAT" in
  dashboard) push_dashboard ;;
  brain) push_brain ;;
  all) push_dashboard; push_brain ;;
  *) fail "uso: $0 [dashboard|brain|all]" ;;
esac
printf '\n\033[0;32m✓ listo\033[0m\n'
