FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

COPY lora_trainer.py inference.py main.py ./

ENV LLM_ADAPTER_DIR=/app/adapters
ENV LLM_BASE_MODEL=sshleifer/tiny-gpt2
RUN mkdir -p /app/adapters

EXPOSE 8082

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8082"]
