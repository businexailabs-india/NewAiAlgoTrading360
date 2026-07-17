FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY libs /workspace/libs
COPY services/paper-test-orchestrator /workspace/services/paper-test-orchestrator
WORKDIR /workspace/services/paper-test-orchestrator
RUN pip install --no-cache-dir -e ../../libs/advisory-core \
    -e ../../libs/mcp-connectors \
    -e ../../libs/strategy-normalizer \
    -e . \
    && pip install --no-cache-dir fastapi uvicorn[standard] httpx prometheus-client
USER appuser
EXPOSE 8092
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8092"]
