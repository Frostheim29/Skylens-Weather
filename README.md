# 🌤️ SkyLens Weather

SkyLens Weather is a modern, responsive weather forecasting web application that provides live weather information, forecasts, weather analytics, location search, saved cities, and weather-reactive visual themes.

The application uses Open-Meteo for weather and geocoding data and provides a lightweight Flask backend for running the application as a Python web app.

---

## 🌐 Live Demo

👉 **[Open SkyLens Weather](https://skylens-weather.onrender.com)**

**GitHub Repository:**  
https://github.com/Frostheim29/skylens-weather

---

## ✨ Features

### 🌍 Global Location Search

- Search for cities, towns, countries, and locations worldwide.
- Search using geographical coordinates.
- Uses Open-Meteo Geocoding API for location search.
- Displays the selected location with coordinates and elevation.

### 📍 Automatic Location Detection

- Use the **Auto** location option to request the browser's location.
- Fetches weather based on the user's current coordinates.
- Does not require an account.

### 🌦️ Live Weather Information

Displays important weather information including:

- Current temperature
- Feels-like temperature
- Humidity
- Wind speed and direction
- Wind gusts
- UV index
- Visibility
- Atmospheric pressure
- Precipitation
- Cloud cover
- Sunrise and sunset
- Daylight duration
- Air quality

### 📅 7-Day Forecast

- View upcoming weather conditions.
- High and low temperatures.
- Precipitation information.
- Weather conditions for each forecast day.

### 📊 Weather Charts

- Visualize weather trends.
- View temperature and other forecast-related information over time.

### 🛰️ Weather Radar

- Access the Weather Radar section for weather visualization and precipitation-related information.

### ⚠️ Weather Alerts

- Dedicated alert section for important weather conditions.
- Visual indicators for conditions requiring attention.

### ⭐ Favorite Cities

- Save frequently visited cities as favorites.
- Favorite cities remain saved after closing and reopening the application.
- No account or sign-in is required.

### 💾 Local User Preferences

SkyLens Weather stores supported user preferences locally in the browser using `localStorage`.

These can include:

- ⭐ Favorite cities
- 📍 Last selected location
- 🌡️ Temperature unit preference
- 🖥️ Other local interface preferences

> Local preferences are browser/device-specific. They are not synchronized between different browsers or devices.

### 🎨 Weather-Reactive Interface

The dashboard changes its visual theme according to the current weather condition.

Different weather conditions can produce different visual styles, including:

- ☀️ Sunny
- 🌤️ Partly cloudy
- ☁️ Cloudy / overcast
- 🌫️ Fog
- 🌧️ Rain
- ❄️ Snow
- ⛈️ Thunderstorm

### 🌡️ Temperature Units

- Celsius (°C)
- Fahrenheit (°F)

### 📥 CSV Export

- Export available weather information as a CSV file for further analysis.

### 📱 Responsive Design

- Designed to work across desktop, tablet, and mobile screen sizes.
- Responsive dashboard layout and navigation.

---

## 🛠️ Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript
- Material Symbols
- Responsive UI design

### Backend

- Python
- Flask

### APIs

- Open-Meteo Weather API
- Open-Meteo Geocoding API
- Open-Meteo Air Quality API

### Deployment

- GitHub
- Render

---

## 📁 Project Structure

```text
weather-app/
│
├── index.html
├── styles.css
├── app.js
├── app.py
├── requirements.txt
├── README.md
└── .gitignore

---

## 🚀 How to Run Locally

### 1. Clone the Repository

```bash
git clone https://github.com/Frostheim29/skylens-weather.git
cd skylens-weather
```

### 2. Create a Virtual Environment

```bash
python -m venv .venv
```

### 3. Activate the Virtual Environment

For Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Run the Application

```bash
python app.py
```

Open the application in your browser:

```text
http://127.0.0.1:5000
```

---

## 🌐 Deployment

SkyLens Weather is deployed using **Render**.

The application is connected to the GitHub repository and is deployed as a Python Flask web application.

**Live Application:**  
https://skylens-weather.onrender.com

---

## 👩‍💻 Author

**Ananya Varshney**

B.Tech Computer Science & Engineering  
AI/ML Specialization

---

## 📄 License

This project is created for educational and portfolio purposes.
