FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY libs /workspace/libs
COPY services/trade-approval-service /workspace/services/trade-approval-service
WORKDIR /workspace/services/trade-approval-service
RUN pip install --no-cache-dir -e ../../libs/advisory-core \
    -e . \
    && pip install --no-cache-dir fastapi uvicorn[standard]
USER appuser
EXPOSE 8098
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8098"]
