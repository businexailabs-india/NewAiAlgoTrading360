FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY libs /workspace/libs
COPY config /workspace/config
COPY services/mcp-connector-service /workspace/services/mcp-connector-service
WORKDIR /workspace/services/mcp-connector-service
ENV MCP_PROVIDERS_CONFIG_DIR=/workspace/config/mcp-providers
ENV LIVE_TRADING_ENABLED=false
ENV PAPER_TRADING_ENABLED=true
ENV MCP_DEFAULT_PROVIDER=paper_trading
ENV MCP_ENABLE_DHAN=true
ENV SECRET_MANAGER_PROVIDER=local_encrypted
ENV LOCAL_SECRET_KEY=change-this-in-production
RUN pip install --no-cache-dir -e ../../libs/advisory-core \
    -e ../../libs/mcp-connectors \
    -e . \
    && pip install --no-cache-dir fastapi "uvicorn[standard]" httpx prometheus-client pyyaml pydantic-settings
USER appuser
EXPOSE 8094
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8094"]
