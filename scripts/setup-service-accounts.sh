#!/bin/bash
set -e

# ==============================================================================
# Script: setup-service-accounts.sh
# Descripción: Creación declarativa/gcloud de Service Accounts con el principio
#              de mínimo privilegio para el proyecto random-507414.
# ==============================================================================

PROJECT_ID="random-507414"

echo "🤖 ======================================================================"
echo "   Aprovisionando Service Accounts (Mínimo Privilegio)"
echo "   Proyecto GCP: $PROJECT_ID"
echo "========================================================================"

create_sa_if_not_exists() {
  local sa_id=$1
  local display_name=$2
  local sa_email="${sa_id}@${PROJECT_ID}.iam.gserviceaccount.com"

  if gcloud iam service-accounts describe "$sa_email" --project="$PROJECT_ID" &>/dev/null; then
    echo "ℹ️ Service Account '$sa_id' ya existe."
  else
    echo "✨ Creando Service Account '$sa_id'..."
    gcloud iam service-accounts create "$sa_id" \
      --display-name="$display_name" \
      --project="$PROJECT_ID"
  fi
}

# 1. SA de Runtime (Cloud Run Backend)
create_sa_if_not_exists "sa-random-backend-runner" "SA Runtime Cloud Run Backend"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:sa-random-backend-runner@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:sa-random-backend-runner@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter" --condition=None >/dev/null

# 2. SA de CI/CD Pipeline (Cloud Build / GitHub Actions)
create_sa_if_not_exists "sa-random-cicd" "SA Pipeline CI/CD"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:sa-random-cicd@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.developer" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:sa-random-cicd@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:sa-random-cicd@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" --condition=None >/dev/null

# 3. SA de Terraform (Provisioning IaC)
create_sa_if_not_exists "sa-random-terraform" "SA Terraform Infrastructure Administrator"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:sa-random-terraform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:sa-random-terraform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.admin" --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:sa-random-terraform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin" --condition=None >/dev/null

echo "✅ Service Accounts y asignaciones de IAM configuradas exitosamente."
