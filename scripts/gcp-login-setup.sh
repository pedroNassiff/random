#!/bin/bash
set -e

# ==============================================================================
# Script: gcp-login-setup.sh
# Descripción: Login en GCP CLI, autenticación Application Default y configuración
#              del proyecto activo en random-507414.
# ==============================================================================

PROJECT_ID="random-507414"
ACCOUNT="${1:-signal@random-lab.es}"

ACTIVE_ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)

if [[ "$ACTIVE_ACCOUNT" == "$ACCOUNT" ]]; then
  echo "✅ Ya estás autenticado como $ACTIVE_ACCOUNT."
else
  echo "🔐 [GCP SETUP] Iniciando autenticación en Google Cloud SDK para $ACCOUNT..."
  gcloud auth login "$ACCOUNT" --no-launch-browser || gcloud auth login --no-launch-browser
fi

echo "🔑 [GCP SETUP] Configurando Application Default Credentials (ADC)..."
gcloud auth application-default login --no-launch-browser || true

echo "🎯 [GCP SETUP] Verificando acceso al proyecto $PROJECT_ID para la cuenta activa..."

if ! gcloud projects describe "$PROJECT_ID" &>/dev/null; then
  echo "⚠️ El proyecto '$PROJECT_ID' no existe o la cuenta activa no tiene permisos sobre él."
  echo ""
  echo "📋 Proyectos disponibles en tu cuenta de Google Cloud:"
  gcloud projects list
  echo ""
  echo "👉 ¿Deseas intentar CREAR el proyecto '$PROJECT_ID'? (y/N)"
  read -r CREATE_PROJ
  if [[ "$CREATE_PROJ" =~ ^[Yy]$ ]]; then
    echo "✨ Intentando crear el proyecto '$PROJECT_ID'..."
    gcloud projects create "$PROJECT_ID" --name="Random Lab"
  else
    echo "💡 Copia el ID de tu proyecto existente de la lista anterior y edita PROJECT_ID en scripts/gcp-login-setup.sh."
    exit 1
  fi
fi

gcloud config set project "$PROJECT_ID"
gcloud auth application-default set-quota-project "$PROJECT_ID" 2>/dev/null || true

echo "⚡ [GCP SETUP] Habilitando APIs requeridas en $PROJECT_ID..."
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  storage.googleapis.com \
  sqladmin.googleapis.com \
  compute.googleapis.com

echo "✅ [GCP SETUP] Autenticación y APIs listas para el proyecto $PROJECT_ID."
