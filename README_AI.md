# ConnectHub AI Layer

This add-on keeps the existing ConnectHub UI and flows intact while adding optional AI/ML APIs, a Python FastAPI model service, backend fallbacks, Mongoose schemas, and standalone frontend widgets.

## What Was Added

- `ai-service/`: FastAPI AI microservice.
- `backend/routes/ai.js`: Node AI API routes under `/api/ai/*` with 20 requests/minute/user rate limiting.
- `backend/services/aiService.js`: HTTP client for Python AI service with graceful local fallbacks.
- `backend/services/matchEngine.js`: Local fallback matching engine.
- `backend/jobs/churnDetection.js`: Async churn detection job function.
- `backend/jobs/trendAnalyzer.js`: 24-hour trend cache job function.
- `backend/models/`: Mongoose schema additions for `User`, `Opportunity`, and `AIInsight`.
- `frontend/ai-widgets.js` and `frontend/ai-widgets.css`: Optional UI widgets that can be loaded without changing existing screens.
- `market-trends.html`: Public AI market trends page.
- `docker-compose.yml`: Runs Node, FastAPI, MongoDB, and Redis together.

## AI Features Covered

1. AI Smart Matchmaking
   - `/api/ai/match-freelancers`
   - `/api/ai/match-startups`
   - Uses FastAPI matching when available; falls back to local token-based matching.

2. AI Profile Auto-Enhancer
   - `/api/ai/enhance-profile`
   - Extracts skills, suggests headlines, writes a starter bio, and scores profile completeness.

3. Semantic Search Foundation
   - `/api/ai/embed`
   - Uses `sentence-transformers/all-MiniLM-L6-v2` when installed. Falls back to deterministic hashing embeddings.

4. Investor Intelligence Dashboard Foundation
   - `/api/ai/market-trends`
   - Returns sector growth, funding goals, demand, and activity signals.

5. AI Networking Assistant
   - `frontend/ai-widgets.js` includes a floating assistant bubble.
   - Production GPT/Claude calls should be connected behind the Node AI route using `.env` API keys.

6. Opportunity-to-Freelancer Auto-Matching
   - Use `/api/ai/match-freelancers` after opportunity creation.
   - WhatsApp sending is intentionally not hardcoded because Twilio/Meta credentials must live in `.env`.

7. Engagement Prediction & Churn Prevention
   - `/api/ai/predict-churn`
   - `backend/jobs/churnDetection.js` prepares re-engagement triggers.

8. AI Media Ad Generator
   - `/api/ai/generate-ad`
   - Optional widget: `frontend/ai-widgets.js`.

9. Multilingual AI Support
   - Optional language toggle in `frontend/ai-widgets.js`.
   - Production translation should call GPT/Claude from the backend with keys in `.env`.

10. Market Trend Analyzer
   - `market-trends.html`
   - `/api/ai/market-trends`
   - `backend/jobs/trendAnalyzer.js`

11. AI Fraud & Spam Detection
   - `/api/ai/score-fraud`
   - Flags suspicious input and returns reasons. It does not block users.

12. Personalized Learning Recommendations
   - `/api/ai/recommend-courses`
   - Returns free resources such as NPTEL, freeCodeCamp, Startup India, and YouTube searches.

## Environment Variables

Create `.env` or set variables in Render:

```bash
AI_SERVICE_URL=http://127.0.0.1:8000
MONGODB_URI=mongodb://localhost:27017/connecthub
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-this
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
SMTP_USER=
SMTP_PASS=
```

Never commit real API keys.

## Run Locally

Node backend:

```bash
npm install
npm start
```

Python AI service:

```bash
cd ai-service
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Docker:

```bash
docker compose up --build
```

## Run AI Tests

```bash
cd ai-service
pytest
```

## How To Enable Optional Widgets

The files are intentionally separate so the current UI stays unchanged. Add these two tags to authenticated pages when you want the widgets visible:

```html
<link rel="stylesheet" href="frontend/ai-widgets.css">
<script src="frontend/ai-widgets.js" defer></script>
```

The widgets use existing colors and hide gracefully if AI APIs are unavailable.

## Production Notes

- Heavy ML packages can require memory. On free tiers, keep the fallback mode enabled or deploy `ai-service` separately.
- FAISS is represented by vector-style matching and can be expanded to persistent FAISS indexes as traffic grows.
- Bull/Redis job files are ready to be scheduled, but the current lightweight server does not force Redis startup.
- Twilio/Meta WhatsApp is intentionally not hardcoded. Add a separate provider module with credentials from `.env`.
