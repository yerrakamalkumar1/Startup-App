from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.chatbot import router as chatbot_router
from routers.location import router as location_router
from routers.market import router as market_router
from routers.risk import router as risk_router
from routers.search import router as search_router

app = FastAPI(title="ConnectHub AI Hub Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router)
app.include_router(location_router)
app.include_router(market_router)
app.include_router(chatbot_router)
app.include_router(risk_router)


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "ConnectHub AI Hub",
        "features": [
            "semantic_search",
            "nearby_opportunities",
            "skill_demand",
            "market_intelligence",
            "risk_scoring",
            "chatbot",
        ],
    }
