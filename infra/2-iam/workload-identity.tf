# ==============================================================================
# 2-iam/workload-identity.tf — Federación de Identidad para GitHub Actions
# ==============================================================================
# CI/CD sin claves JSON (CIS Benchmark GCP): GitHub Actions se autentica
# impersonando sa-random-cicd vía OIDC, sin exportar ni almacenar ninguna
# clave de Service Account.

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"
  description               = "Pool de identidad federada para el pipeline de CI/CD en GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  display_name                       = "GitHub OIDC Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  # Solo tokens OIDC emitidos para el repo pedroNassiff/random pueden
  # autenticarse — mínimo privilegio a nivel de origen del token.
  attribute_condition = "assertion.repository == \"pedroNassiff/random\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Permite que workflows del repo pedroNassiff/random impersonen a
# sa-random-cicd (ya tiene run.developer + artifactregistry.writer, ver main.tf).
resource "google_service_account_iam_member" "cicd_wif_binding" {
  service_account_id = google_service_account.cicd.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/pedroNassiff/random"
}

output "workload_identity_provider" {
  description = "Resource name completo para GOOGLE_GITHUB_ACTIONS workload_identity_provider"
  value       = google_iam_workload_identity_pool_provider.github.name
}
