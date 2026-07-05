"""Hybrid semantic + TF-IDF RAG index."""
from __future__ import annotations

from dataclasses import dataclass

from embeddings import embed_query, embed_texts
from rag import TfidfRagIndex, chunk_text


@dataclass
class SemanticChunk:
    text: str
    metadata: dict
    embedding: list[float]


class HybridRagIndex:
    def __init__(self):
        self.tfidf = TfidfRagIndex()
        self.semantic_chunks: list[SemanticChunk] = []

    def add_documents(self, documents: list[dict]) -> int:
        added = 0
        texts_for_embed: list[str] = []
        meta_for_embed: list[dict] = []

        for doc in documents:
            for chunk in chunk_text(doc.get("text", "")):
                texts_for_embed.append(chunk)
                meta_for_embed.append(doc.get("metadata") or {})
                added += 1

        self.tfidf.add_documents(documents)

        if texts_for_embed:
            vectors = embed_texts(texts_for_embed)
            self.semantic_chunks = [
                SemanticChunk(text=t, metadata=m, embedding=e)
                for t, m, e in zip(texts_for_embed, meta_for_embed, vectors)
            ]
        return added

    def query(self, query: str, top_k: int = 5, symbol: str | None = None) -> list[dict]:
        tfidf_hits = self.tfidf.query(query, top_k * 2, symbol)
        if not self.semantic_chunks:
            return [
                {"text": h.text, "score": h.score, "metadata": h.metadata, "method": "tfidf"}
                for h in tfidf_hits[:top_k]
            ]

        q_vec = embed_query(query)
        sem_scores: list[tuple[float, SemanticChunk]] = []
        for ch in self.semantic_chunks:
            if symbol and ch.metadata.get("symbol") and ch.metadata["symbol"].upper() != symbol.upper():
                continue
            dot = sum(a * b for a, b in zip(q_vec, ch.embedding))
            sem_scores.append((float(dot), ch))

        sem_scores.sort(key=lambda x: x[0], reverse=True)
        merged: dict[str, dict] = {}

        for hit in tfidf_hits:
            key = hit.text[:80]
            merged[key] = {
                "text": hit.text,
                "score": hit.score * 0.35,
                "metadata": hit.metadata,
                "method": "hybrid",
            }

        for score, ch in sem_scores[: top_k * 2]:
            if score < 0.25:
                continue
            key = ch.text[:80]
            if key in merged:
                merged[key]["score"] = merged[key]["score"] + score * 0.65
            else:
                merged[key] = {
                    "text": ch.text,
                    "score": score * 0.65,
                    "metadata": ch.metadata,
                    "method": "hybrid",
                }

        ranked = sorted(merged.values(), key=lambda x: x["score"], reverse=True)
        return ranked[:top_k]


_user_hybrid: dict[str, HybridRagIndex] = {}


def rebuild_hybrid_index(user_id: str, documents: list[dict]) -> int:
    idx = HybridRagIndex()
    count = idx.add_documents(documents)
    _user_hybrid[user_id] = idx
    return count


def query_hybrid(user_id: str, query: str, top_k: int = 5, symbol: str | None = None) -> list[dict]:
    idx = _user_hybrid.get(user_id)
    if not idx:
        return []
    return idx.query(query, top_k, symbol)
