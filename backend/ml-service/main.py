"""SmartTrade Python ML sidecar — FastAPI + scikit-learn + RAG."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from semantic_rag import query_hybrid, rebuild_hybrid_index
from rag import get_index, rebuild_index
from embeddings import embed_texts
from trainer import predict_symbol, train_symbol

app = FastAPI(title="SmartTrade ML Service", version="2.0.0")


class Bar(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float = 0


class TrainRequest(BaseModel):
    engine_id: str
    symbol: str
    bars: list[Bar]
    horizon_days: int = Field(default=7, ge=1, le=30)
    test_ratio: float = Field(default=0.2, gt=0, lt=0.5)
    model_type: str = Field(default="gradient_boosting")
    validation_mode: str = Field(default="walk_forward")
    tune_hyperparams: bool = False


class PredictRequest(BaseModel):
    engine_id: str
    symbol: str
    bars: list[Bar]
    current_price: float
    horizon_days: int = Field(default=7, ge=1, le=30)
    min_accuracy: float = Field(default=50.0, ge=0, le=100)
    rag_context: str | None = None


class RagDocument(BaseModel):
    text: str
    metadata: dict = Field(default_factory=dict)


class RagIngestRequest(BaseModel):
    user_id: str
    documents: list[RagDocument]
    mode: str = Field(default="hybrid")  # tfidf | hybrid


class EmbedRequest(BaseModel):
    texts: list[str]


class RagQueryRequest(BaseModel):
    user_id: str
    query: str
    top_k: int = Field(default=5, ge=1, le=20)
    symbol: str | None = None
    mode: str = Field(default="hybrid")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "sklearn-advanced",
        "models": [
            "gradient_boosting",
            "random_forest",
            "hist_gradient_boosting",
            "stacking",
            "ensemble_vote",
        ],
        "rag": "hybrid-semantic-tfidf",
        "embeddings": "sentence-transformers/all-MiniLM-L6-v2",
    }


@app.post("/train")
def train(req: TrainRequest):
    try:
        bars = [b.model_dump() for b in req.bars]
        result = train_symbol(
            req.engine_id,
            req.symbol,
            bars,
            req.horizon_days,
            req.test_ratio,
            req.model_type,
            req.validation_mode,
            req.tune_hyperparams,
        )
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/predict")
def predict(req: PredictRequest):
    try:
        bars = [b.model_dump() for b in req.bars]
        result = predict_symbol(
            req.engine_id,
            req.symbol,
            bars,
            req.current_price,
            req.horizon_days,
            req.min_accuracy,
            req.rag_context,
        )
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/rag/ingest")
def rag_ingest(req: RagIngestRequest):
    docs = [{"text": d.text, "metadata": d.metadata} for d in req.documents]
    if req.mode == "hybrid":
        count = rebuild_hybrid_index(req.user_id, docs)
    else:
        count = rebuild_index(req.user_id, docs)
    return {"success": True, "data": {"chunks_indexed": count, "mode": req.mode}}


@app.post("/embed")
def embed(req: EmbedRequest):
    vectors = embed_texts(req.texts)
    return {"success": True, "data": {"embeddings": vectors, "dimensions": len(vectors[0]) if vectors else 0}}


@app.post("/rag/query")
def rag_query(req: RagQueryRequest):
    mode = getattr(req, "mode", "hybrid")
    if mode == "hybrid":
        hits = query_hybrid(req.user_id, req.query, req.top_k, req.symbol)
    else:
        idx = get_index(req.user_id)
        hits = [
            {"text": h.text, "score": round(h.score, 4), "metadata": h.metadata, "method": "tfidf"}
            for h in idx.query(req.query, req.top_k, req.symbol)
        ]
    return {"success": True, "data": {"hits": hits}}
