# ==============================================================================
# 3-networking/main.tf — Modelo de Red e Integración Serverless
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

# Red VPC por defecto o personalizada para conectar Cloud Run con recursos privados
data "google_compute_network" "default" {
  name    = "default"
  project = var.project_id
}

output "network_name" {
  description = "Nombre de la red VPC asignada"
  value       = data.google_compute_network.default.name
}
