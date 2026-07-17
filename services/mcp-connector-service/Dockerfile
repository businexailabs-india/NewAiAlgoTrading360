FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY libs /workspace/libs
COPY services/mcp-connector-service /workspace/services/mcp-connector-service
WORKDIR /workspace/services/mcp-connector-service
RUN pip install --no-cache-dir -e ../../libs/advisory-core \
    -e ../../libs/mcp-connectors \
    -e . \
    && pip install --no-cache-dir fastapi uvicorn[standard] httpx prometheus-client
USER appuser
EXPOSE 8094
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8094"]
