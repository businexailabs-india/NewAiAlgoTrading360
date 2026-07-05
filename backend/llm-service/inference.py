"""Inference with base model + optional LoRA adapter, or Ollama proxy."""
from __future__ import annotations

import os
from pathlib import Path

ADAPTER_DIR = Path(os.environ.get("LLM_ADAPTER_DIR", "/app/adapters"))


def generate_with_adapter(
    prompt: str,
    adapter_job_id: str | None = None,
    max_tokens: int = 512,
) -> str:
    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError:
        return "LLM inference dependencies not installed."

    base_model = os.environ.get("LLM_BASE_MODEL", "sshleifer/tiny-gpt2")
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
    )

    if adapter_job_id:
        adapter_path = ADAPTER_DIR / adapter_job_id
        if adapter_path.exists():
            model = PeftModel.from_pretrained(model, str(adapter_path))

    inputs = tokenizer(prompt, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {k: v.cuda() for k, v in inputs.items()}

    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=max_tokens, do_sample=True, temperature=0.7)

    return tokenizer.decode(out[0], skip_special_tokens=True)
