# ==============================================================================
# 0-bootstrap/main.tf — Bucket GCS para el Estado Remoto de Terraform
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

# Bucket para almacenar el terraform.tfstate de forma segura
resource "google_storage_bucket" "tfstate" {
  name                        = "${var.project_id}-tfstate"
  location                    = "US"
  force_destroy               = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 5
    }
  }

}

output "tfstate_bucket_name" {
  description = "Nombre del bucket GCS creado para el estado de Terraform"
  value       = google_storage_bucket.tfstate.name
}
