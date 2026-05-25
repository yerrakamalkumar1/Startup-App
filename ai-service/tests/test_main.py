from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_embed_endpoint():
    response = client.post("/embed", json={"text": "React developer for fintech startup"})
    assert response.status_code == 200
    body = response.json()
    assert len(body["embedding"]) == 384


def test_match_freelancers_endpoint():
    response = client.post("/match-freelancers", json={
        "startup": {"name": "Health SaaS", "sector": "Health & Wellness", "city": "Hyderabad", "bio": "Need React and branding"},
        "freelancers": [{"name": "Kamal", "title": "React Video Editor", "skills": ["React", "Branding"], "city": "Hyderabad"}],
    })
    assert response.status_code == 200
    assert response.json()["matches"][0]["score"] >= 0


def test_match_startups_endpoint():
    response = client.post("/match-startups", json={
        "investor": {"name": "Angel", "sector": "SaaS & Technology"},
        "startups": [{"name": "B2B SaaS", "sector": "SaaS & Technology", "profileScore": 80}],
    })
    assert response.status_code == 200
    assert response.json()["matches"][0]["name"] == "B2B SaaS"


def test_enhance_profile_endpoint():
    response = client.post("/enhance-profile", json={"name": "Kamal", "title": "Video Editor", "skills": []})
    assert response.status_code == 200
    assert "headlineSuggestions" in response.json()


def test_score_fraud_endpoint():
    response = client.post("/score-fraud", json={"email": "x@mailinator.com", "description": "urgent payment"})
    assert response.status_code == 200
    assert response.json()["fraudScore"] > 0


def test_predict_churn_endpoint():
    response = client.post("/predict-churn", json={"daysSinceLastActive": 10, "loginFrequency": 0})
    assert response.status_code == 200
    assert "churnProbability" in response.json()


def test_generate_ad_endpoint():
    response = client.post("/generate-ad", json={"productName": "Video Editing", "targetAudience": "cafes", "tone": "friendly"})
    assert response.status_code == 200
    assert len(response.json()["variants"]) == 3


def test_recommend_courses_endpoint():
    response = client.post("/recommend-courses", json={"skills": ["React"], "sector": "SaaS & Technology"})
    assert response.status_code == 200
    assert len(response.json()["recommendations"]) == 3


def test_market_trends_endpoint():
    response = client.get("/market-trends")
    assert response.status_code == 200
    assert "growingSectors" in response.json()
