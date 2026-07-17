FROM python:3.12-slim
WORKDIR /app
RUN useradd -m -u 10001 appuser
COPY libs /workspace/libs
COPY services/language-intent-service /workspace/services/language-intent-service
WORKDIR /workspace/services/language-intent-service
RUN pip install --no-cache-dir -e ../../libs/advisory-core \
    -e ../../libs/language-core \
    -e ../../libs/intent-core \
    -e ../../libs/trade-command-parser \
    -e . \
    && pip install --no-cache-dir fastapi uvicorn[standard]
USER appuser
EXPOSE 8097
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8097"]
