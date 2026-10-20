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

      # Bundle de replay (estados EEG precomputados + snapshots de /lab/brain/doc).
      # Se publica desde local con backend/scripts/upload_replay_bundle.sh; la SA
      # del runner ya tiene objectViewer sobre el bucket (storage.tf).
      env {
        name  = "REPLAY_BUNDLE_URI"
        value = "gs://${google_storage_bucket.assets.name}/replay"
      }

      # Fútbol Vaquero (/vaca-futbolera). Ver docs/la-vaca-futbol/README.md §7.
      # Sin FUTBOL_ADMIN_EMAILS nadie puede entrar; sin FUTBOL_BASE_URL el magic link apunta a localhost.
      # Sin FUTBOL_SMTP_HOST el link se escribe en los logs de Cloud Run (solo para arrancar: configurar SMTP).
      env {
        name  = "FUTBOL_ADMIN_EMAILS"
        value = "signal@random-lab.es,dimitri@lavacacoworking.com"
      }

      env {
        name  = "FUTBOL_BASE_URL"
        value = "https://random-lab.es"
      }

      # Magic links por mail desde signal@random-lab.es (Hostinger, STARTTLS 587; SPF ya autoriza a Hostinger).
      env {
        name  = "FUTBOL_SMTP_HOST"
        value = "smtp.hostinger.com"
      }

      env {
        name  = "FUTBOL_SMTP_PORT"
        value = "587"
      }

      env {
        name  = "FUTBOL_SMTP_USER"
        value = "signal@random-lab.es"
      }

      env {
        name  = "FUTBOL_MAIL_FROM"
        value = "Fútbol Vaquero <signal@random-lab.es>"
      }

      env {
        name = "FUTBOL_SMTP_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.futbol_smtp_password.secret_id
            version = "latest"
          }
        }
      }

      # /dashboard (CRM de Random). Allowlist de emails con acceso; la sesión es la misma que la de Fútbol Vaquero.
      # Sin DASHBOARD_EMAILS nadie entra: los datos fiscales fallan cerrado. No reutiliza FUTBOL_ADMIN_EMAILS
      # a propósito (los admins del grupo de fútbol no deben ver datos fiscales).
      env {
        name  = "DASHBOARD_EMAILS"
        value = "signal@random-lab.es"
      }

      # Documentos que se adjuntan al agente fiscal. Sin esta variable el backend escribe en disco local,
      # que en Cloud Run se pierde con cada instancia.
      env {
        name  = "FISCAL_DOCS_BUCKET"
        value = google_storage_bucket.fiscal_docs.name
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

      # Vertex AI nativo (ai/vertex_client.py) — no son credenciales, solo
      # identificadores de proyecto/región, no necesitan Secret Manager.
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "GCP_VERTEX_LOCATION"
        value = var.region
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

