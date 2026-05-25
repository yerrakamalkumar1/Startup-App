import hashlib
import math
import os
from functools import lru_cache
from typing import List

MODEL_NAME = os.getenv("SENTENCE_TRANSFORMER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
VECTOR_DIMS = 384


@lru_cache(maxsize=1)
def _model():
    if os.getenv("CONNECTHUB_DISABLE_HEAVY_AI") == "1":
        return None
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(MODEL_NAME)
    except Exception:
        return None


def _hash_embedding(text: str, dims: int = VECTOR_DIMS) -> List[float]:
    vector = [0.0] * dims
    tokens = str(text or "").lower().replace("/", " ").replace(",", " ").split()
    if not tokens:
        tokens = ["connecthub"]
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        for index, byte in enumerate(digest):
            slot = (byte + index * 31) % dims
            vector[slot] += 1.0 if byte % 2 == 0 else -1.0
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [round(value / norm, 6) for value in vector]


def embed_text(text: str) -> List[float]:
    model = _model()
    if model is not None:
        try:
            vector = model.encode([text or ""], normalize_embeddings=True)[0]
            return [round(float(value), 6) for value in vector[:VECTOR_DIMS]]
        except Exception:
            pass
    return _hash_embedding(text)


def cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right:
        return 0.0
    size = min(len(left), len(right))
    dot = sum(left[i] * right[i] for i in range(size))
    left_norm = math.sqrt(sum(left[i] * left[i] for i in range(size))) or 1.0
    right_norm = math.sqrt(sum(right[i] * right[i] for i in range(size))) or 1.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))
