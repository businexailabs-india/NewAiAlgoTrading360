"""Lightweight RAG — TF-IDF retrieval (no external vector DB)."""
from __future__ import annotations

import re
from dataclasses import dataclass

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 80) -> list[str]:
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return chunks


@dataclass
class RagHit:
    text: str
    score: float
    metadata: dict


class TfidfRagIndex:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(max_features=8000, stop_words="english")
        self.chunks: list[str] = []
        self.metadata: list[dict] = []
        self.matrix = None

    def add_documents(self, documents: list[dict]) -> int:
        """documents: [{text, metadata}]"""
        added = 0
        for doc in documents:
            for chunk in chunk_text(doc.get("text", "")):
                self.chunks.append(chunk)
                self.metadata.append(doc.get("metadata") or {})
                added += 1
        if self.chunks:
            self.matrix = self.vectorizer.fit_transform(self.chunks)
        return added

    def query(self, query: str, top_k: int = 5, symbol: str | None = None) -> list[RagHit]:
        if not self.chunks or self.matrix is None:
            return []
        q = self.vectorizer.transform([query])
        scores = cosine_similarity(q, self.matrix).flatten()
        ranked = np.argsort(scores)[::-1]

        hits: list[RagHit] = []
        for idx in ranked:
            if scores[idx] < 0.05:
                continue
            meta = self.metadata[idx]
            if symbol and meta.get("symbol") and meta["symbol"].upper() != symbol.upper():
                continue
            hits.append(RagHit(text=self.chunks[idx], score=float(scores[idx]), metadata=meta))
            if len(hits) >= top_k:
                break
        return hits


# Per-user in-memory indexes (persisted via Node Postgres; rebuilt on ingest)
_user_indexes: dict[str, TfidfRagIndex] = {}


def get_index(user_id: str) -> TfidfRagIndex:
    if user_id not in _user_indexes:
        _user_indexes[user_id] = TfidfRagIndex()
    return _user_indexes[user_id]


def rebuild_index(user_id: str, documents: list[dict]) -> int:
    idx = TfidfRagIndex()
    count = idx.add_documents(documents)
    _user_indexes[user_id] = idx
    return count
