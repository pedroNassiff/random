# ==============================================================================
# 4-services/migrate-job.tf — Cloud Run Job de migraciones
# ==============================================================================
# Corre `futbol.infrastructure.migrate` (schemas futbol y fiscal, en ese orden)
# con la misma imagen y los mismos secretos que el servicio. Lo ejecuta el
# pipeline de deploy antes de pasar el tráfico a la revisión nueva, después de
# un backup bajo demanda de Cloud SQL (ver .github/workflows/deploy-brain-backend.yml).
#
# Sin esto, un módulo que NEO construye y vos aprobás llegaría a producción sin
# sus tablas. FinOps: un Job sin ejecuciones no cuesta nada.

resource "google_cloud_run_v2_job" "brain_migrate" {
  name     = "brain-migrate"
  location = var.region
  project  = var.project_id

  template {
    task_count = 1

    template {
      service_account = "sa-random-backend-runner@${var.project_id}.iam.gserviceaccount.com"
      max_retries     = 0 # una migración que falla no se reintenta sola
      timeout         = "300s"

      containers {
        image   = "${var.region}-docker.pkg.dev/${var.project_id}/random-repo/brain-backend:latest"
        command = ["sh", "-c"]
        args = [
          "python -m futbol.infrastructure.migrate --schema futbol && python -m futbol.infrastructure.migrate --schema fiscal",
        ]

        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url.secret_id
              version = "latest"
            }
          }
        }

        # El runner le pone esta contraseña al usuario neo_reader (migración fiscal/009).
        env {
          name = "NEO_DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.neo_database_url.secret_id
              version = "latest"
            }
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.postgres.connection_name]
        }
      }
    }
  }

  # El pipeline actualiza la imagen al SHA desplegado en cada deploy.
  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image]
  }
}
