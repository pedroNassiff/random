# Modelo IAM y Gobernanza de Accesos (Random Studio / Random Lab)

## 1. Filosofía de Seguridad & Mínimo Privilegio
El modelo de Identidad y Gestión de Accesos (IAM) de Random Lab aplica estrictamente el principio de **Mínimo Privilegio**:
- Ningún servicio de runtime posee roles genéricos (`roles/editor` o `roles/owner`).
- Cada componente tiene su propia **Service Account (SA)** con permisos delimitados a los recursos específicos que necesita.
- La Service Account que aplica la infraestructura vía IaC (Terraform) está completamente segregada de las Service Accounts de ejecución de la aplicación.

---

## 2. Matriz de Service Accounts

```
┌────────────────────────────────┬───────────────────────────────────────────┬─────────────────────────────────────────────────┐
│ SERVICE ACCOUNT                │ ROLES ASIGNADOS                           │ PROPÓSITO & ALCANCE                             │
├────────────────────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────────┤
│ sa-random-backend-runner       │ - roles/cloudsql.client                   │ Ejecución del contenedor FastAPI en Cloud Run.  │
│                                │ - roles/secretmanager.secretAccessor      │ Lectura de DATABASE_URL y API Keys en Secret M. │
│                                │ - roles/storage.objectViewer              │ Lectura de assets estáticos en Cloud Storage.   │
├────────────────────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────────┤
│ sa-random-cicd                 │ - roles/run.developer                     │ Despliegue de nuevas revisiones en Cloud Run.   │
│                                │ - roles/artifactregistry.writer           │ Push de imágenes Docker construidas por CI/CD. │
├────────────────────────────────┼───────────────────────────────────────────┼─────────────────────────────────────────────────┤
│ sa-random-terraform            │ - roles/resourcemanager.projectIamAdmin   │ Aprovisionamiento declarativo de infraestructura│
│                                │ - roles/run.admin                         │ en GCP vía IaC.                                 │
│                                │ - roles/storage.admin                     │                                                 │
└────────────────────────────────┴───────────────────────────────────────────┴─────────────────────────────────────────────────┘
```

---

## 3. Claves de Acceso y Gestión de Credenciales (CIS Benchmark)
- **Cero Claves JSON descargadas:** Las Service Accounts no usan archivos JSON de claves privadas descargados localmente. La autenticación en Cloud Run y Cloud Build se realiza vía Workload Identity o metadata de GCP.
- **Inyección de Secretos:** `DATABASE_URL` y tokens se inyectan a nivel de proceso en Cloud Run mediante la integración nativa con Secret Manager (`--set-secrets`).
