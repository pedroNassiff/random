# ==============================================================================
# 4-services/storage.tf — Bucket GCS de Assets y Datasets
# ==============================================================================

resource "google_storage_bucket" "assets" {
  name                        = "${var.project_id}-assets"
  location                    = var.region
  project                     = var.project_id
  force_destroy               = false
  uniform_bucket_level_access = true

  cors {
    origin = [
      "https://random-lab.es",
      "https://www.random-lab.es",
      "https://random-studio.io",
      "https://www.random-studio.io",
      "http://localhost:5173",
      "http://localhost:3000"
    ]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "runner_object_viewer" {
  bucket = google_storage_bucket.assets.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:sa-random-backend-runner@${var.project_id}.iam.gserviceaccount.com"

}

# ------------------------------------------------------------------------------
# Documentos fiscales del dashboard (036, justificantes, notificaciones).
# Datos personales: bucket privado y separado del de assets, sin CORS (solo lo lee
# el backend) y sin acceso público posible. El cifrado en reposo es el de Google
# (sin CMEK: Cloud KMS no entra en el Always Free Tier).
# ------------------------------------------------------------------------------
resource "google_storage_bucket" "fiscal_docs" {
  name                        = "${var.project_id}-fiscal-docs"
  location                    = var.region
  project                     = var.project_id
  force_destroy               = false
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Un documento borrado o pisado por error se puede recuperar durante 30 días.
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 30
    }
    action {
      type = "Delete"
    }
  }
}

# Mínimo privilegio: el runner crea, lee y borra objetos solo en este bucket.
resource "google_storage_bucket_iam_member" "runner_fiscal_docs_object_user" {
  bucket = google_storage_bucket.fiscal_docs.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:sa-random-backend-runner@${var.project_id}.iam.gserviceaccount.com"
}

output "assets_bucket_name" {
  description = "Nombre del bucket GCS para assets"
  value       = google_storage_bucket.assets.name
}
