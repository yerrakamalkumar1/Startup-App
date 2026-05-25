import hashlib
import math
import re
from functools import lru_cache
from typing import List

VECTOR_DIM = 384


@lru_cache(maxsize=1)
def _sentence_model():
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    except Exception:
        return None


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def fallback_embedding(text: str, dim: int = VECTOR_DIM) -> List[float]:
    """Deterministic hashing vector used when transformer models are unavailable."""
    vector = [0.0] * dim
    tokens = re.findall(r"[a-zA-Z0-9+#.-]+", normalize_text(text))
    if not tokens:
        return vector
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dim
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [round(value / norm, 6) for value in vector]


def embed_text(text: str) -> List[float]:
    model = _sentence_model()
    if model is None:
        return fallback_embedding(text)
    vector = model.encode([text or ""], normalize_embeddings=True)[0]
    return [float(value) for value in vector.tolist()]


def cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right:
        return 0.0
    limit = min(len(left), len(right))
    dot = sum(left[i] * right[i] for i in range(limit))
    left_norm = math.sqrt(sum(value * value for value in left[:limit])) or 1.0
    right_norm = math.sqrt(sum(value * value for value in right[:limit])) or 1.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))
