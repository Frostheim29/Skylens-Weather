# SkyLens Weather

SkyLens Weather is a responsive, global weather dashboard inspired by the supplied reference design. It uses Open-Meteo for geocoding, forecast and air-quality data and changes the dashboard palette according to the current weather condition.

## What is included

- Global city/town/country search
- Coordinate search (`latitude, longitude`)
- Current conditions
- 7-day forecast
- 24-hour weather trend
- Temperature, humidity, wind, pressure, precipitation, cloud cover and visibility metrics
- Sunrise, sunset and daylight information
- Saved locations using browser local storage
- Celsius/Fahrenheit switch
- CSV export
- Weather-reactive dashboard backgrounds
- Radar-style visual screen
- Alert screen based on displayed forecast thresholds
- Optional Python/Flask backend for serving the app and proxying Open-Meteo requests

## Weather-reactive background

The dashboard automatically selects a visual theme from the current WMO weather code:

- Sunny / clear
- Partly cloudy
- Cloudy / overcast
- Fog
- Rain / showers
- Snow
- Thunderstorm

The change is deliberately subtle so the dashboard remains readable. The page background, hero card and accent palette shift without sacrificing contrast.

## Run the app with Python

### 1. Install Python

Python 3.10+ is recommended.

### 2. Open a terminal in this folder

```bash
cd weather-app
```

### 3. Create a virtual environment (recommended)

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Windows Command Prompt:

```cmd
python -m venv .venv
.venv\\Scripts\\activate
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Start SkyLens

```bash
python app.py
```

Then open:

`http://127.0.0.1:5000`

## How the Python code works

`app.py` is a small Flask server. It:

1. Serves `index.html`, `styles.css` and `app.js`.
2. Provides `/api/geocode` for global place search.
3. Provides `/api/weather` for forecast data.
4. Provides `/api/air-quality` for air-quality data.
5. Provides `/api/health` as a simple health check.
6. Proxies requests to Open-Meteo using Python's standard-library HTTP client.

The UI itself is still implemented with HTML, CSS and JavaScript because those technologies run directly in the browser. Python is used as the optional web backend.

## Run without Python

For a quick static demo, `index.html` can also be opened directly in a browser. In that mode the frontend can communicate directly with the public Open-Meteo endpoints. For the complete Python-backed version, use `python app.py`.

## Project structure

```text
weather-app/
├── index.html          # Page structure and navigation
├── styles.css          # Dashboard styling and weather themes
├── app.js              # UI logic, search, forecasts and interactions
├── app.py              # Flask server and Open-Meteo proxy
├── requirements.txt    # Python dependency list
└── README.md           # Project documentation
```

## Data source

Weather and geocoding data are provided by Open-Meteo. The application does not require an API key for the basic public endpoints used by this demo.

## Important note about Radar

The current Radar screen is a radar-style visualization for the dashboard experience. It is **not** a live weather-radar tile feed. A production version could connect it to a real radar/precipitation tile provider if live radar imagery is required.

## Customization

The main weather-theme logic is in `app.js` inside `applyWeatherTheme()`. The corresponding colors are in `styles.css` under:

```css
body.weather-sunny
body.weather-partly-cloudy
body.weather-cloudy
body.weather-fog
body.weather-rain
body.weather-snow
body.weather-storm
```

This makes it easy to change the visual mood for any weather condition.


## Location & weather themes
- **Auto** requests the browser's location permission and loads weather for the detected coordinates.
- A reverse-geocoding request is used to display the nearest city/region name when available.
- The dashboard theme changes visibly between sunny, partly cloudy, cloudy, fog, rain, snow, and storm conditions.
- If location permission is denied, use the global search bar instead.
