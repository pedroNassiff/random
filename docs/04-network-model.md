# Modelo de Red, Conectividad y CORS

## 1. Conectividad Vercel ↔ GCP Cloud Run
- **Frontend (Vercel):** Se comunica vía HTTPS / WSS cifrado (TLS 1.3) con la URL pública asignada por GCP Cloud Run (`https://brain-prototype-api-xxxx.a.run.app`).
- **Política CORS (Cross-Origin Resource Sharing):**
  - Restringida a los orígenes permitidos de Vercel:
    - `https://random-studio.io`
    - `https://www.random-studio.io`
    - `https://random-portfolio-*.vercel.app` (para previews)

## 2. Ingress & Egress en Cloud Run
- **Ingress Policy:** `all` (Permite tráfico de Internet encriptado HTTPS/TLS).
- **Egress Policy:** Tráfico saliente a Internet permitido para consumo de APIs externas (e.g. OpenAI API, InfluxDB si es externo).
- **WebSockets:** Tráfico habilitado con `timeout` de lectura extendido en Cloud Run para streaming continuo de señales EEG.
