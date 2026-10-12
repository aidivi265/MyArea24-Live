import json
from unittest.mock import MagicMock, patch
from backend.app.services.gemini_assistant import query_gemini_assistant, GeminiAssistantSchema


def test_gemini_assistant_without_key_returns_none(db_session):
    with patch("backend.app.core.config.settings.GEMINI_API_KEY", None):
        with patch.dict("os.environ", {}, clear=True):
            result = query_gemini_assistant(
                query="How is the traffic right now?",
                area_name="Delhi Connaught Place",
                target_lat=28.6304,
                target_lon=77.2177,
                is_live_supported=True,
                db=db_session,
            )
            assert result is None


def test_gemini_assistant_with_key_successful_generation(db_session):
    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "response_text": "Live telemetry indicates smooth traffic along Connaught Place outer circle with clear weather at 28°C.",
        "key_findings": [
            "No critical bottlenecks on radial corridors",
            "Weather nominal at 28°C with 0mm precipitation"
        ],
        "recommendations": [
            "Normal driving times expected",
            "Carry light clothing for warm midday temperatures"
        ],
        "grounded_sources": ["WeatherAPI", "TomTom Traffic API v5"],
        "confidence": "HIGH (Gemini Grounded RAG)"
    })

    with patch("backend.app.core.config.settings.GEMINI_API_KEY", "test-gemini-key"):
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.models.generate_content.return_value = mock_response
            mock_client_cls.return_value = mock_client

            result = query_gemini_assistant(
                query="Is it safe to drive right now?",
                area_name="Delhi Connaught Place",
                target_lat=28.6304,
                target_lon=77.2177,
                is_live_supported=True,
                db=db_session,
            )

            assert result is not None
            assert "smooth traffic" in result["response_text"]
            assert len(result["key_findings"]) == 2
            assert result["confidence"] == "HIGH (Gemini Grounded RAG)"
            assert "TomTom Traffic API v5" in result["grounded_sources"]


def test_gemini_assistant_api_endpoint_integration(client):
    # Test that /assistant endpoint handles queries seamlessly with mocked Gemini response
    mock_gemini = {
        "query": "traffic delays",
        "area": "Delhi Connaught Place",
        "is_live_supported": True,
        "response_text": "Live telemetry indicates traffic delays around Delhi Connaught Place.",
        "key_findings": ["Congestion near Outer Circle"],
        "recommendations": ["Allow extra travel time"],
        "grounded_sources": ["TomTom Traffic API v5", "WeatherAPI"],
        "confidence": "HIGH (Gemini Grounded RAG)",
        "timestamp": "2026-10-11T12:00:00Z",
    }
    with patch("backend.app.api.intelligence.query_gemini_assistant", return_value=mock_gemini):
        res = client.get("/api/v1/intelligence/assistant?query=traffic+delays&area=Delhi+Connaught+Place")
        assert res.status_code == 200
        data = res.json()
        assert data["query"] == "traffic delays"
        assert data["area"] == "Delhi Connaught Place"
        assert data["is_live_supported"] is True
        assert len(data["grounded_sources"]) >= 1
        assert "response_text" in data
        assert "key_findings" in data
        assert "recommendations" in data
