# ==============================================================================
# 2-iam/main.tf — Service Accounts e IAM Bindings (Mínimo Privilegio)
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type    = string
  default = "random-507414"
}

variable "region" {
  type    = string
  default = "us-central1"
}

# 1. Service Account para el runtime de Cloud Run Backend
resource "google_service_account" "backend_runner" {
  account_id   = "sa-random-backend-runner"
  display_name = "Service Account — Cloud Run Backend Runtime"
  project      = var.project_id
}

# Permisos mínimos para Runtime: Cloud SQL Client y Writer de Logs
resource "google_project_iam_member" "runner_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend_runner.email}"
}

resource "google_project_iam_member" "runner_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.backend_runner.email}"
}

# Vertex AI (Gemini nativo para ai/copilot_labs_service.py) — solo
# aiplatform.user, no admin: alcanza para invocar modelos, nada más.
resource "google_project_iam_member" "runner_vertex_ai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.backend_runner.email}"
}

# 2. Service Account para CI/CD (Cloud Build / GitHub Actions)
resource "google_service_account" "cicd" {
  account_id   = "sa-random-cicd"
  display_name = "Service Account — Pipeline CI/CD"
  project      = var.project_id
}

resource "google_project_iam_member" "cicd_run_dev" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

resource "google_project_iam_member" "cicd_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

output "backend_runner_sa_email" {
  description = "Email de la Service Account de runtime del backend"
  value       = google_service_account.backend_runner.email
}

output "cicd_sa_email" {
  description = "Email de la Service Account de CI/CD"
  value       = google_service_account.cicd.email
}
