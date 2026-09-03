# Cloud Run image for brain-prototype-api.
#
# Ships only the Analytics + Prospecting CRM surface — the EEG/hardware/ML
# stack (torch, mne, muselsl, pylsl, bleak) stays local-only. main.py detects
# their absence and degrades gracefully (HARDWARE_AVAILABLE=False).
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-cloud.txt .
RUN pip install --no-cache-dir -r requirements-cloud.txt

COPY . .

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
