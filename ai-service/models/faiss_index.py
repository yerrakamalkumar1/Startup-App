from typing import Any, Dict, List

from models.embedder import VECTOR_DIMS, cosine_similarity, embed_text

try:
    import numpy as np
except Exception:
    np = None

try:
    import faiss
except Exception:
    faiss = None


class ProfileIndex:
    def __init__(self):
        self.items: List[Dict[str, Any]] = []
        self.vectors: List[List[float]] = []
        self.index = None

    def build(self, items: List[Dict[str, Any]]) -> None:
        self.items = items or []
        self.vectors = [
            item.get("profileVector") or embed_text(_item_text(item))
            for item in self.items
        ]
        if faiss is None or np is None or not self.vectors:
            self.index = None
            return
        matrix = np.array(self.vectors, dtype="float32")
        self.index = faiss.IndexFlatIP(VECTOR_DIMS)
        self.index.add(matrix)

    def search(self, query: str, k: int = 20) -> List[Dict[str, Any]]:
        if not self.items:
            self.build(default_profiles())
        query_vector = embed_text(query)
        if self.index is not None and np is not None:
            query_matrix = np.array([query_vector], dtype="float32")
            distances, indices = self.index.search(query_matrix, min(k, len(self.items)))
            results = []
            for score, index in zip(distances[0], indices[0]):
                if index < 0:
                    continue
                item = dict(self.items[int(index)])
                item["semanticScore"] = round(float(max(0.0, min(1.0, score))), 4)
                results.append(item)
            return results
        scored = []
        for item, vector in zip(self.items, self.vectors):
            copy = dict(item)
            copy["semanticScore"] = round(cosine_similarity(query_vector, vector), 4)
            scored.append(copy)
        return sorted(scored, key=lambda row: row["semanticScore"], reverse=True)[:k]


def _item_text(item: Dict[str, Any]) -> str:
    return " ".join(
        str(item.get(key, ""))
        for key in ["name", "title", "role", "sector", "city", "skills", "description", "companyName"]
    )


def default_profiles() -> List[Dict[str, Any]]:
    return [
        {
            "id": "kamal",
            "name": "Kamal Kumar",
            "role": "freelancer",
            "title": "Photographer and Editor",
            "city": "Hyderabad",
            "sector": "Media & Entertainment",
            "skills": ["photography", "video editing", "reels", "social media"],
            "lat": 17.385,
            "lng": 78.4867,
        },
        {
            "id": "nexalocal",
            "name": "NexaLocal Commerce",
            "role": "startup",
            "title": "Local commerce startup",
            "city": "Hyderabad",
            "sector": "Commerce & Retail",
            "skills": ["branding", "marketing", "operations"],
            "lat": 17.42,
            "lng": 78.45,
        },
        {
            "id": "india-venture",
            "name": "India Venture Fund",
            "role": "investor",
            "title": "Seed investor",
            "city": "Bangalore",
            "sector": "SaaS & Technology",
            "skills": ["seed funding", "marketplaces", "fintech"],
            "lat": 12.9716,
            "lng": 77.5946,
        },
    ]


profile_index = ProfileIndex()
