# ==============================================================================
# 4-services/cloud-run.tf — Despliegue de Cloud Run (Serverless, Scale to Zero)
# ==============================================================================

resource "google_cloud_run_v2_service" "brain_backend" {
  name     = "brain-prototype-api"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = "sa-random-backend-runner@${var.project_id}.iam.gserviceaccount.com"

    scaling {
      min_instance_count = 0 # Scale to Zero (FinOps $0 inactivo)
      max_instance_count = 3
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/random-repo/brain-backend:latest"

      resources {
        limits = {
          cpu    = "1000m"
          memory = "1024Mi"
        }
      }

      ports {
        container_port = 8000
      }

      env {
        name  = "CORS_ORIGINS"
        value = "https://random-lab.es,https://www.random-lab.es,https://random-studio.io,https://www.random-studio.io,http://localhost:5173,http://localhost:3000"
      }

      env {
        name  = "EXTRA_ALLOWED_HOSTS"
        value = "*.run.app,api.random-lab.es,api.random-studio.io,localhost,127.0.0.1"
      }

      # Secretos inyectados desde GCP Secret Manager
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_api_key.secret_id
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }
    }

    # Cloud SQL Auth Proxy nativo de Cloud Run — expone el socket Unix que
    # usa DATABASE_URL (?host=/cloudsql/...) sin salir a la red pública.
    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.postgres.connection_name]
      }
    }
  }

  # El pipeline de CI/CD (.github/workflows/deploy-brain-backend.yml) hace
  # `gcloud run deploy --image=...:$GITHUB_SHA` en cada push a main. Terraform
  # compara el string de `image` contra su propio state, no el contenido real
  # de la tag `:latest` — sin este ignore_changes, un `terraform apply` de
  # infra (env vars, scaling) pisaría la revisión que dejó el pipeline.
  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }
}

# Permitir invocación pública de Cloud Run (autenticada a nivel de app / CORS)
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.brain_backend.location
  name     = google_cloud_run_v2_service.brain_backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "brain_backend_url" {
  description = "URL pública invocable HTTPS de Cloud Run para brain-backend"
  value       = google_cloud_run_v2_service.brain_backend.uri
}

