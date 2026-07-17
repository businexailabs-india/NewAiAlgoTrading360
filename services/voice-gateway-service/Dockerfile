FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY libs /workspace/libs
COPY services/voice-gateway-service /workspace/services/voice-gateway-service
WORKDIR /workspace/services/voice-gateway-service
RUN pip install --no-cache-dir -e ../../libs/advisory-core \
    -e ../../libs/voice-core \
    -e . \
    && pip install --no-cache-dir fastapi uvicorn[standard] httpx prometheus-client
USER appuser
EXPOSE 8096
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8096"]
