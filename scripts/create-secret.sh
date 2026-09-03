#!/bin/bash
set -e

# ==============================================================================
# Script: create-secret.sh
# Descripción: Creación interactiva de secretos en GCP Secret Manager con
#              definición de propósito y asignación de permisos a la SA de runtime.
# ==============================================================================

PROJECT_ID="random-507414"
RUNNER_SA="sa-random-backend-runner@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🔐 ======================================================================"
echo "   GCP Secret Manager — Creación de Secreto Interactivo"
echo "   Proyecto: $PROJECT_ID"
echo "   Runtime Service Account: $RUNNER_SA"
echo "========================================================================"
echo ""

# 1. Solicitar categoría/prefijo del secreto
echo "Seleccione el tipo/categoría del secreto:"
echo " 1) API Key de OpenAI (prefijo: sa-openai-)"
echo " 2) API Key de Anthropic / Claude (prefijo: sa-anthropic-)"
echo " 3) Credencial de Aplicación / DB / SMTP (prefijo: random-)"
read -p "Opción [1-3]: " SECRET_CAT

case $SECRET_CAT in
  1) PREFIX="sa-openai-" ;;
  2) PREFIX="sa-anthropic-" ;;
  3) PREFIX="random-" ;;
  *) echo "❌ Opción inválida. Cancelando."; exit 1 ;;
esac

# 2. Solicitar sufijo del nombre del secreto
read -p "Ingrese el nombre del secreto (ej: api-key, database-url, smtp-pass): " SUFFIX
SECRET_NAME="${PREFIX}${SUFFIX}"

# 3. Solicitar descripción/propósito del secreto
read -p "Describa para qué se usa este secreto (propósito): " SECRET_PURPOSE

# 4. Solicitar el valor del secreto de forma segura (sin eco en terminal)
read -sp "Ingrese el VALOR del secreto (no se mostrará en pantalla): " SECRET_VALUE
echo ""

if [[ -z "$SECRET_VALUE" ]]; then
  echo "❌ El valor del secreto no puede estar vacío. Cancelando."
  exit 1
fi

echo ""
echo "🚀 Procesando secreto en GCP Secret Manager..."
echo "   ID del Secreto: $SECRET_NAME"
echo "   Propósito: $SECRET_PURPOSE"

# Verificar si el secreto ya existe
if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
  echo "⚠️ El secreto '$SECRET_NAME' ya existe. Añadiendo nueva versión..."
  echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project="$PROJECT_ID"
else
  echo "✨ Creando nuevo secreto '$SECRET_NAME'..."
  gcloud secrets create "$SECRET_NAME" \
    --replication-policy="automatic" \
    --project="$PROJECT_ID" \
    --labels="purpose=app-credentials,managed-by=script"

  echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" --data-file=- --project="$PROJECT_ID"
fi

# Asignar permiso secretAccessor a la SA de runtime
echo "🔑 Otorgando permiso roles/secretmanager.secretAccessor a $RUNNER_SA..."
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:${RUNNER_SA}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$PROJECT_ID" >/dev/null

echo "✅ Secreto '$SECRET_NAME' configurado exitosamente y accesible para $RUNNER_SA."
