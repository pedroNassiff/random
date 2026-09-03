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

output "assets_bucket_name" {
  description = "Nombre del bucket GCS para assets"
  value       = google_storage_bucket.assets.name
}
