"""SkyLens Weather - lightweight Flask backend.

The browser UI remains HTML/CSS/JavaScript. This Python file provides optional
server-side proxy endpoints for Open-Meteo so the project can be run as a
normal Python web application instead of opening index.html directly.
"""

from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"


def fetch_json(url: str, params: dict):
    """Fetch JSON from an upstream Open-Meteo endpoint."""
    query = urlencode({k: v for k, v in params.items() if v is not None})
    req = Request(
        f"{url}?{query}",
        headers={"User-Agent": "SkyLens-Weather/1.0"},
    )
    try:
        with urlopen(req, timeout=15) as response:
            return response.status, response.read()
    except HTTPError as exc:
        return exc.code, exc.read()
    except URLError as exc:
        raise RuntimeError(f"Upstream weather service unavailable: {exc.reason}") from exc


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:path>")
def static_files(path):
    return send_from_directory(BASE_DIR, path)


@app.get("/api/geocode")
def geocode():
    name = request.args.get("name", "").strip()
    if len(name) < 2:
        return jsonify({"results": []})

    status, payload = fetch_json(
        GEOCODING_URL,
        {
            "name": name,
            "count": request.args.get("count", 8),
            "language": "en",
            "format": "json",
        },
    )
    return (payload, status, {"Content-Type": "application/json"})


@app.get("/api/weather")
def weather():
    allowed = {
        "latitude",
        "longitude",
        "current",
        "hourly",
        "daily",
        "timezone",
        "forecast_days",
    }
    params = {key: request.args.get(key) for key in allowed if request.args.get(key) is not None}
    status, payload = fetch_json(WEATHER_URL, params)
    return (payload, status, {"Content-Type": "application/json"})


@app.get("/api/air-quality")
def air_quality():
    allowed = {"latitude", "longitude", "current", "timezone"}
    params = {key: request.args.get(key) for key in allowed if request.args.get(key) is not None}
    status, payload = fetch_json(AIR_QUALITY_URL, params)
    return (payload, status, {"Content-Type": "application/json"})


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "app": "SkyLens Weather"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
