# ConnectHub AI Hub

AI Hub is an additive module for ConnectHub. It adds a new dashboard route at `/dashboard/aihub` and API routes under `/api/aihub/*` without changing the existing dashboard pages.

## What It Adds

- Freelancer AI Hub: nearby opportunities, skill demand heatmap, AI suggestions, local radar, and AI rate estimator.
- Startup Owner AI Hub: talent pool radar, market intelligence, competitor radar, ecosystem map, and growth suggestions.
- Investor/Sponsor AI Hub: deal flow radar, sector intelligence, live deal news, portfolio risk analyzer, and India geo map.
- Location permission flow with GPS and IP fallback.
- Context-aware AI chatbot opened from the teal sparkle button.
- Real-time notification and live update hooks through Socket.IO.

## API Routes

Node routes are available at:

- `POST /api/aihub/locate`
- `POST /api/aihub/search`
- `GET /api/aihub/nearby-opportunities`
- `GET /api/aihub/skill-demand`
- `GET /api/aihub/feed`
- `GET /api/aihub/market-intel`
- `GET /api/aihub/competitor-radar`
- `GET /api/aihub/ecosystem-map`
- `GET /api/aihub/growth-suggestions`
- `GET /api/aihub/deal-flow`
- `GET /api/aihub/sector-intel`
- `GET /api/aihub/deal-news`
- `POST /api/aihub/portfolio-risk`
- `GET /api/aihub/geo-investment-map`
- `POST /api/aihub/rate-estimate`
- `POST /api/aihub/chatbot`
- `GET /api/aihub/notifications`

All AI Hub routes are rate-limited to 20 requests per minute per user/IP.

## Python AI Service

Run locally:

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Set `CONNECTHUB_DISABLE_HEAVY_AI=1` for low-memory development. The service will use deterministic embeddings and fallbacks if sentence-transformers, FAISS, API keys, or model downloads are unavailable.

Python endpoints:

- `POST /embed`
- `POST /search`
- `POST /nearby-opportunities`
- `POST /skill-demand`
- `POST /ai-feed-item`
- `POST /market-intel`
- `POST /competitor-radar`
- `POST /growth-suggestions`
- `POST /risk-score`
- `POST /portfolio-risk`
- `POST /rate-estimate`
- `POST /chatbot`
- `GET /geo-map-data`
- `POST /classify-intent`

Legacy endpoints from the earlier AI service are preserved.

## External APIs

The module supports these optional free-tier integrations:

- Google Places API for nearby businesses.
- NewsAPI for startup and sector news.
- Adzuna for live jobs.
- pytrends for Google Trends signals.
- OpenAI or Anthropic for generated insights.

Without keys, ConnectHub returns clean fallback cards so the UI remains usable on a zero-budget Render deployment.

## Docker Compose

```bash
docker compose up --build
```

This starts:

- `connecthub-web` on port `3000`
- `connecthub-ai` on port `8000`
- Redis on port `6379`

## Frontend

The AI Hub UI lives in `frontend/aihub/`:

- `aihub.html`
- `aihub.css`
- `aihub.js`
- `freelancer-hub.js`
- `startup-hub.js`
- `investor-hub.js`
- `chatbot.js`
- `notifications.js`

The page uses the existing teal `#0f766e`, DM Sans, card styling, responsive mobile layout, Leaflet maps, Chart.js charts, and readable light/dark mode CSS variables.

## Tests

Run FastAPI tests:

```bash
cd ai-service
pytest -q
```

The tests cover health, embeddings, semantic search, nearby opportunities, skill demand, market intelligence, risk, chatbot, and preserved legacy routes.
