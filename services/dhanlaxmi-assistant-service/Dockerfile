FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY pyproject.toml /workspace/pyproject.toml
COPY libs /workspace/libs
COPY services/dhanlaxmi-assistant-service /workspace/services/dhanlaxmi-assistant-service
WORKDIR /workspace/services/dhanlaxmi-assistant-service
# PyPI runtime deps first, then every local lib with --no-deps (workspace names are not on PyPI)
RUN pip install --no-cache-dir \
      fastapi "uvicorn[standard]" httpx prometheus-client \
      pydantic pydantic-settings pyyaml numpy pandas \
      redis sqlalchemy asyncpg httpx \
    && for d in ../../libs/*/ ; do \
         if [ -f "${d}pyproject.toml" ]; then pip install --no-cache-dir --no-deps -e "$d"; fi; \
       done \
    && pip install --no-cache-dir --no-deps -e .
USER appuser
EXPOSE 8095
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8095"]
