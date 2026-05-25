from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_embed():
    response = client.post("/embed", json={"text": "React developer for fintech startup"})
    assert response.status_code == 200
    body = response.json()
    assert len(body["embedding"]) == 384


def test_search():
    response = client.post("/search", json={"query": "photographer in Hyderabad", "city": "Hyderabad"})
    assert response.status_code == 200
    body = response.json()
    assert body["results"]
    assert "sources_used" in body


def test_nearby_opportunities():
    response = client.post("/nearby-opportunities", json={"lat": 17.385, "lng": 78.4867, "user_sector": "Media & Entertainment"})
    assert response.status_code == 200
    assert response.json()["results"]


def test_skill_demand():
    response = client.post("/skill-demand", json={"skills": ["video editing", "react", "branding"]})
    assert response.status_code == 200
    assert response.json()["skills"]


def test_market_and_risk_endpoints():
    assert client.post("/market-intel", json={"sector": "SaaS & Technology"}).status_code == 200
    assert client.post("/competitor-radar", json={"description": "local commerce platform"}).status_code == 200
    assert client.post("/growth-suggestions", json={"sector": "Commerce & Retail"}).status_code == 200
    assert client.post("/rate-estimate", json={"skill": "video editing", "experience": 2}).status_code == 200
    assert client.get("/geo-map-data").status_code == 200
    assert client.post("/risk-score", json={"sector": "SaaS & Technology", "profileScore": 80}).status_code == 200
    assert client.post("/portfolio-risk", json={"startups": [{"sector": "SaaS & Technology"}, {"sector": "Health & Wellness"}]}).status_code == 200


def test_chatbot_and_legacy_routes():
    assert client.post("/chatbot", json={"message": "How do I find gigs?", "user": {"role": "freelancer", "city": "Hyderabad"}}).status_code == 200
    assert client.post("/classify-intent", json={"text": "find design gigs near me"}).status_code == 200
    assert client.post("/match-freelancers", json={"startup": {"sector": "Media"}, "freelancers": []}).status_code == 200
    assert client.post("/match-startups", json={"investor": {"sector": "SaaS"}, "startups": []}).status_code == 200
    assert client.post("/enhance-profile", json={"name": "Kamal", "title": "Photographer"}).status_code == 200
    assert client.post("/score-fraud", json={"email": "kamal@example.com"}).status_code == 200
    assert client.post("/predict-churn", json={"loginFrequency": 4}).status_code == 200
    assert client.post("/generate-ad", json={"productName": "editing"}).status_code == 200
    assert client.post("/recommend-courses", json={"skills": ["video editing"]}).status_code == 200
    assert client.get("/market-trends").status_code == 200
