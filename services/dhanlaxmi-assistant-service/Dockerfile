FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY pyproject.toml /workspace/pyproject.toml
COPY libs /workspace/libs
COPY services/dhanlaxmi-assistant-service /workspace/services/dhanlaxmi-assistant-service
WORKDIR /workspace/services/dhanlaxmi-assistant-service
RUN pip install --no-cache-dir -e ../../libs/advisory-core \
    -e ../../libs/language-core \
    -e ../../libs/voice-core \
    -e ../../libs/intent-core \
    -e ../../libs/trade-command-parser \
    -e ../../libs/safety-guardrails \
    -e ../../libs/localized-response-templates \
    -e . \
    && pip install --no-cache-dir fastapi uvicorn[standard] httpx prometheus-client
USER appuser
EXPOSE 8095
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8095"]
