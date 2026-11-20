FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NODE_ENV=production \
    DATA_DIR=/app/data MODELS_DIR=/app/models ARTIFACTS_DIR=/app/artifacts \
    OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
WORKDIR /app
COPY backend/ml-service/requirements.lock.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && \
    useradd --uid 1000 --create-home fedhealth && \
    mkdir -p /app/data/uploads /app/models /app/artifacts && chown -R fedhealth:fedhealth /app
COPY --chown=fedhealth:fedhealth backend/ml-service/app ./app
USER fedhealth
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
