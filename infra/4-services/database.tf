# ==============================================================================
# 4-services/database.tf — Cloud SQL PostgreSQL (db-f1-micro)
# ==============================================================================
# Reemplaza el placeholder que traía el secret `random-database-url`. Sin IP
# pública — Cloud Run se conecta vía el socket Unix nativo del Cloud SQL Auth
# Proxy integrado (ver `volumes.cloud_sql_instance` en cloud-run.tf), sobre la
# red interna de Google, no por la red pública.
#
# FinOps: db-f1-micro (~$7-9/mes) es la única pieza de este landing zone que
# no cae en el Always Free Tier — se acepta a cambio de que toda la infra,
# incluida la base de datos, quede gestionada por Terraform de punta a punta
# (ver docs/00-landing-zone-spec.md §7 para la alternativa serverless $0/mes).

resource "google_sql_database_instance" "postgres" {
  name             = "random-postgres"
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_15"

  settings {
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"
    disk_autoresize   = false

    backup_configuration {
      enabled = false # FinOps: sin backups automáticos por ahora
    }

    ip_configuration {
      # GCP exige al menos un modo de conectividad habilitado (Public IP,
      # Private IP o PSC). Private IP requeriría VPC peering con Service
      # Networking (no armado — infra/3-networking solo referencia la red
      # `default`, sin peering). Se deja la IP pública habilitada pero sin
      # `authorized_networks`: nada puede conectar directo por ahí — el
      # Cloud SQL Auth Proxy nativo de Cloud Run no usa esa ruta, autentica
      # vía la Cloud SQL Admin API con IAM (roles/cloudsql.client).
      ipv4_enabled = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "random_analytics" {
  name     = "random_analytics"
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
}

resource "random_password" "db_user_password" {
  length  = 24
  special = false
}

resource "google_sql_user" "app_user" {
  name     = "random_app"
  project  = var.project_id
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_user_password.result
}

# Nueva versión del secret con la connection string real. Cloud Run lee
# `version = "latest"` (cloud-run.tf), así que esto reemplaza el placeholder
# sin tocar nada manualmente.
resource "google_secret_manager_secret_version" "database_url_value" {
  secret = google_secret_manager_secret.database_url.id
  secret_data = join("", [
    "postgresql://${google_sql_user.app_user.name}:${random_password.db_user_password.result}",
    "@/${google_sql_database.random_analytics.name}",
    "?host=/cloudsql/${google_sql_database_instance.postgres.connection_name}",
  ])
}

output "cloud_sql_connection_name" {
  description = "Connection name para el volume cloud_sql_instance de Cloud Run"
  value       = google_sql_database_instance.postgres.connection_name
}
