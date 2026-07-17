FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY libs /workspace/libs
COPY services/external-algo-discovery-service /workspace/services/external-algo-discovery-service
WORKDIR /workspace/services/external-algo-discovery-service
RUN pip install --no-cache-dir -e ../../libs/advisory-core \
    -e ../../libs/strategy-normalizer \
    -e . \
    && pip install --no-cache-dir fastapi uvicorn[standard] httpx prometheus-client
USER appuser
EXPOSE 8093
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8093"]
