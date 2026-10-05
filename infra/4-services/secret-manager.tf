# ==============================================================================
# 4-services/secret-manager.tf — GCP Secret Manager & Permisos
# ==============================================================================

resource "google_secret_manager_secret" "database_url" {
  secret_id = "random-database-url"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    purpose    = "database-connection"
    managed_by = "terraform"
  }
}

resource "google_secret_manager_secret" "anthropic_api_key" {
  secret_id = "sa-anthropic-api-key"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    purpose    = "claude-llm-integration"
    managed_by = "terraform"
  }
}

# Contraseña del buzón signal@random-lab.es (SMTP de Hostinger) para los magic links de Fútbol Vaquero.
# El valor NO vive en Terraform: se carga a mano con `gcloud secrets versions add futbol-smtp-password`.
resource "google_secret_manager_secret" "futbol_smtp_password" {
  secret_id = "futbol-smtp-password"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    purpose    = "futbol-magic-link-email"
    managed_by = "terraform"
  }
}

# IAM Binding: Otorgar permiso secretAccessor a la Service Account del runner
resource "google_secret_manager_secret_iam_member" "db_url_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:sa-random-backend-runner@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_secret_manager_secret_iam_member" "anthropic_key_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.anthropic_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:sa-random-backend-runner@${var.project_id}.iam.gserviceaccount.com"
}

resource "google_secret_manager_secret_iam_member" "futbol_smtp_password_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.futbol_smtp_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:sa-random-backend-runner@${var.project_id}.iam.gserviceaccount.com"
}


import {
  to = google_secret_manager_secret.database_url
  id = "projects/random-507414/secrets/random-database-url"
}

import {
  to = google_secret_manager_secret.anthropic_api_key
  id = "projects/random-507414/secrets/sa-anthropic-api-key"
}

import {
  to = google_secret_manager_secret.futbol_smtp_password
  id = "projects/random-507414/secrets/futbol-smtp-password"
}
