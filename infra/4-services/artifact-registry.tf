# ==============================================================================
# 4-services/artifact-registry.tf — Repo Docker para imágenes de los microservicios
# ==============================================================================
# Repositorio referenciado por google_cloud_run_v2_service.brain_backend
# (cloud-run.tf) y por el pipeline de CI/CD, que hace el build/push de la
# imagen en cada push a main. Terraform NO construye ni sube imágenes — solo
# provisiona el repo donde el pipeline las deja.

resource "google_artifact_registry_repository" "random_repo" {
  repository_id = "random-repo"
  project       = var.project_id
  location      = var.region
  format        = "DOCKER"
  description   = "Imágenes de contenedor de los microservicios de Random Lab (brain-prototype-api)"

  # FinOps (spec §7): retener solo las últimas 2 imágenes por tag,
  # y purgar imágenes sin tag después de 1 día.
  cleanup_policies {
    id     = "keep-last-2-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 2
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "86400s"
    }
  }
}

output "artifact_registry_repo_url" {
  description = "URL del repo Docker para push de imágenes (usado por el pipeline de CI/CD)"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.random_repo.repository_id}"
}
