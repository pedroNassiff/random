# ==============================================================================
# 1-projects/main.tf — Declaración del Proyecto GCP y Habilitación de APIs
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

# APIs requeridas por la Landing Zone Lite de Random Lab
locals {
  gcp_services = [
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "storage.googleapis.com",
    "sqladmin.googleapis.com",
    "compute.googleapis.com"
  ]
}

resource "google_project_service" "services" {
  for_each                   = toset(local.gcp_services)
  project                    = var.project_id
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}
