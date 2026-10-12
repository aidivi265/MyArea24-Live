import pytest
from starlette.testclient import TestClient
from backend.app.main import app


def test_cors_preflight_and_headers():
    client = TestClient(app)

    # 1. Test local frontend origin
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Authorization,Content-Type",
    }
    res = client.options("/health", headers=headers)
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert res.headers.get("access-control-allow-credentials") == "true"

    # 2. Test GitHub Pages hosted demo origin
    gh_headers = {
        "Origin": "https://aidivi265.github.io",
        "Access-Control-Request-Method": "GET",
    }
    gh_res = client.options("/health", headers=gh_headers)
    assert gh_res.status_code == 200
    assert gh_res.headers.get("access-control-allow-origin") == "https://aidivi265.github.io"
    assert gh_res.headers.get("access-control-allow-credentials") == "true"

    # 3. Direct GET request preserves CORS headers
    get_res = client.get("/health", headers={"Origin": "https://aidivi265.github.io"})
    assert get_res.status_code == 200
    assert get_res.headers.get("access-control-allow-origin") == "https://aidivi265.github.io"
    assert get_res.headers.get("access-control-allow-credentials") == "true"
