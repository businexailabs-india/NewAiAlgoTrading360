"""LoRA / QLoRA fine-tuning with PEFT (GPU recommended)."""
from __future__ import annotations

import json
import os
from pathlib import Path

ADAPTER_DIR = Path(os.environ.get("LLM_ADAPTER_DIR", "/app/adapters"))
ADAPTER_DIR.mkdir(parents=True, exist_ok=True)


def _has_gpu() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False


def train_lora(
    job_id: str,
    base_model: str,
    train_type: str,
    dataset: list[dict],
    config: dict | None = None,
) -> dict:
    """Train LoRA or QLoRA adapter. dataset: [{instruction, input, output}]"""
    cfg = config or {}
    force_cpu = cfg.get("force_cpu", False)
    use_qlora = train_type.lower() == "qlora"

    if not _has_gpu() and not force_cpu:
        raise RuntimeError(
            "GPU required for LoRA/QLoRA. Set force_cpu=true for tiny CPU demo, "
            "or deploy llm-service on a GPU instance."
        )

    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            BitsAndBytesConfig,
            TrainingArguments,
            Trainer,
            DataCollatorForLanguageModeling,
        )
    except ImportError as e:
        raise RuntimeError(f"LLM training deps missing: {e}") from e

    out_dir = ADAPTER_DIR / job_id
    out_dir.mkdir(parents=True, exist_ok=True)

    # Tiny model for CPU demo; swap via LLM_BASE_MODEL env for production
    model_name = base_model or os.environ.get("LLM_BASE_MODEL", "sshleifer/tiny-gpt2")
    max_steps = int(cfg.get("max_steps", 20 if force_cpu else 100))
    lora_r = int(cfg.get("lora_r", 8))
    lora_alpha = int(cfg.get("lora_alpha", 16))

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quant_config = None
    if use_qlora and _has_gpu():
        quant_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=quant_config,
        device_map="auto" if _has_gpu() else None,
        torch_dtype=torch.float16 if _has_gpu() else torch.float32,
    )

    if use_qlora and _has_gpu():
        model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        target_modules=cfg.get("target_modules", ["c_attn"] if "gpt2" in model_name.lower() else ["q_proj", "v_proj"]),
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)

    def format_example(ex):
        prompt = f"### Instruction:\n{ex['instruction']}\n### Input:\n{ex.get('input', '')}\n### Response:\n{ex['output']}"
        return tokenizer(prompt, truncation=True, max_length=512, padding="max_length")

    ds = Dataset.from_list(dataset)
    tokenized = ds.map(format_example, remove_columns=ds.column_names)

    training_args = TrainingArguments(
        output_dir=str(out_dir),
        per_device_train_batch_size=int(cfg.get("batch_size", 1)),
        max_steps=max_steps,
        learning_rate=float(cfg.get("learning_rate", 2e-4)),
        logging_steps=5,
        save_steps=max_steps,
        report_to="none",
        fp16=_has_gpu(),
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )
    train_result = trainer.train()
    model.save_pretrained(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))

    metrics = {
        "train_loss": float(train_result.training_loss) if train_result.training_loss else None,
        "steps": max_steps,
        "gpu": _has_gpu(),
        "train_type": train_type,
        "base_model": model_name,
    }
    (out_dir / "metrics.json").write_text(json.dumps(metrics), encoding="utf-8")

    return {
        "adapter_path": str(out_dir),
        "metrics": metrics,
        "status": "completed",
    }


def list_adapters() -> list[dict]:
    adapters = []
    if not ADAPTER_DIR.exists():
        return adapters
    for p in ADAPTER_DIR.iterdir():
        if p.is_dir() and (p / "adapter_config.json").exists():
            metrics_file = p / "metrics.json"
            metrics = {}
            if metrics_file.exists():
                metrics = json.loads(metrics_file.read_text(encoding="utf-8"))
            adapters.append({"job_id": p.name, "path": str(p), "metrics": metrics})
    return adapters
