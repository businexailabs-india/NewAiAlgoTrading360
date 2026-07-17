FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY pyproject.toml /workspace/pyproject.toml
COPY libs /workspace/libs
COPY services/ai-advisory-service /workspace/services/ai-advisory-service
WORKDIR /workspace/services/ai-advisory-service
RUN pip install --no-cache-dir -e ../../libs/advisory-core \
    -e ../../libs/mcp-connectors \
    -e ../../libs/strategy-normalizer \
    -e ../../libs/risk-explainability \
    -e ../../libs/market-regime-detector \
    -e . \
    && pip install --no-cache-dir fastapi uvicorn[standard] alembic asyncpg httpx prometheus-client
USER appuser
EXPOSE 8091
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091"]
