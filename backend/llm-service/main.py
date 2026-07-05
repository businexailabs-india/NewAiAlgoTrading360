"""SmartTrade LLM Service — LoRA/QLoRA training + adapter inference."""
from __future__ import annotations

from fastapi import BackgroundTasks, FastAPI, HTTPException
from pydantic import BaseModel, Field

from inference import generate_with_adapter
from lora_trainer import list_adapters, train_lora

app = FastAPI(title="SmartTrade LLM Service", version="1.0.0")

_jobs: dict[str, dict] = {}


class TrainExample(BaseModel):
    instruction: str
    input: str = ""
    output: str


class LoraTrainRequest(BaseModel):
    job_id: str
    base_model: str = "sshleifer/tiny-gpt2"
    train_type: str = Field(default="lora", pattern="^(lora|qlora)$")
    dataset: list[TrainExample]
    config: dict = Field(default_factory=dict)


class GenerateRequest(BaseModel):
    prompt: str
    adapter_job_id: str | None = None
    max_tokens: int = Field(default=512, ge=32, le=2048)


def _run_train(job_id: str, req: LoraTrainRequest):
    try:
        _jobs[job_id]["status"] = "running"
        result = train_lora(
            job_id,
            req.base_model,
            req.train_type,
            [e.model_dump() for e in req.dataset],
            req.config,
        )
        _jobs[job_id].update({"status": "completed", **result})
    except Exception as e:
        _jobs[job_id].update({"status": "failed", "error": str(e)})


@app.get("/health")
def health():
    gpu = False
    try:
        import torch
        gpu = torch.cuda.is_available()
    except ImportError:
        pass
    return {
        "status": "ok",
        "service": "llm-lora-qlora",
        "gpu_available": gpu,
        "adapters": len(list_adapters()),
    }


@app.post("/train/lora")
def start_lora_train(req: LoraTrainRequest, background_tasks: BackgroundTasks):
    if len(req.dataset) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 training examples")
    _jobs[req.job_id] = {"status": "queued", "train_type": req.train_type}
    background_tasks.add_task(_run_train, req.job_id, req)
    return {"success": True, "data": {"job_id": req.job_id, "status": "queued"}}


@app.get("/train/{job_id}")
def get_train_status(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"success": True, "data": job}


@app.get("/adapters")
def get_adapters():
    return {"success": True, "data": list_adapters()}


@app.post("/generate")
def generate(req: GenerateRequest):
    try:
        text = generate_with_adapter(req.prompt, req.adapter_job_id, req.max_tokens)
        return {"success": True, "data": {"text": text}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
