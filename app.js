const APP_NAME = 'SkyLens';
const USE_PYTHON_BACKEND = ['localhost','127.0.0.1'].includes(window.location.hostname);
const GEO_API = USE_PYTHON_BACKEND ? '/api/geocode' : 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = USE_PYTHON_BACKEND ? '/api/weather' : 'https://api.open-meteo.com/v1/forecast';
const AQ_API = USE_PYTHON_BACKEND ? '/api/air-quality' : 'https://air-quality-api.open-meteo.com/v1/air-quality';

const STORAGE_KEY = 'skylens-preferences';

const DEFAULT_LOCATION = {
  name: 'Tokyo',
  country: 'Japan',
  country_code: 'JP',
  latitude: 35.6764,
  longitude: 139.6500,
  elevation: 40,
  admin1: 'Tokyo'
};

function loadPreferences() {
  try {
    const saved = JSON.parse(
      localStorage.getItem('skylens-preferences') || '{}'
    );

    return {
      unit: saved.unit === 'F' ? 'F' : 'C',
      favorites: Array.isArray(saved.favorites)
        ? saved.favorites
        : [],
      currentLocation: saved.currentLocation || DEFAULT_LOCATION,
      lastScreen: saved.lastScreen || 'dashboard'
    };

  } catch (error) {
    console.warn('Could not load saved preferences:', error);

    return {
      unit: 'C',
      favorites: [],
      currentLocation: DEFAULT_LOCATION,
      lastScreen: 'dashboard'
    };
  }
}

const preferences = loadPreferences();

let unit = preferences.unit;
let favorite = false;
let activeMetric = 'temp';
let currentLocation = preferences.currentLocation;
let weather = null;
let air = null;
let savedLocations = preferences.favorites;
let searchTimer;

function savePreferences() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        unit,
        favorites: savedLocations,
        currentLocation,
        lastScreen:
          document.querySelector('.nav-item.active')?.dataset.screen ||
          'dashboard'
      })
    );
  } catch (error) {
    console.warn('Could not save preferences:', error);
    toast('Could not save settings on this browser.');
  }
}

const app = document.getElementById('app');
const search = document.getElementById('city-search');
const results = document.getElementById('search-results');

const weatherCodes = {
  0:['Clear sky','sunny'],1:['Mainly clear','partly_cloudy_day'],2:['Partly cloudy','partly_cloudy_day'],3:['Overcast','cloudy'],
  45:['Fog','foggy'],48:['Depositing rime fog','foggy'],51:['Light drizzle','rainy_light'],53:['Drizzle','rainy_light'],55:['Heavy drizzle','rainy_heavy'],
  56:['Light freezing drizzle','rainy_light'],57:['Heavy freezing drizzle','rainy_heavy'],61:['Light rain','rainy_light'],63:['Rain','rainy'],65:['Heavy rain','rainy_heavy'],
  66:['Light freezing rain','rainy_light'],67:['Heavy freezing rain','rainy_heavy'],71:['Light snow','weather_snowy'],73:['Snow','weather_snowy'],75:['Heavy snow','weather_snowy'],
  77:['Snow grains','weather_snowy'],80:['Light rain showers','rainy_light'],81:['Rain showers','rainy'],82:['Heavy rain showers','rainy_heavy'],85:['Snow showers','weather_snowy'],
  86:['Heavy snow showers','weather_snowy'],95:['Thunderstorm','thunderstorm'],96:['Thunderstorm with hail','thunderstorm'],99:['Thunderstorm with heavy hail','thunderstorm']
};

function weatherInfo(code){ return weatherCodes[code] || ['Mixed conditions','partly_cloudy_day']; }

function applyWeatherTheme(code){
  const body=document.body;
  const themes=['sunny','partly-cloudy','cloudy','fog','rain','snow','storm'];
  body.classList.remove(...themes.map(t=>`weather-${t}`));
  let theme='cloudy';
  if(code===0) theme='sunny';
  else if(code===1 || code===2) theme='partly-cloudy';
  else if(code===3) theme='cloudy';
  else if(code===45 || code===48) theme='fog';
  else if([71,73,75,77,85,86].includes(code)) theme='snow';
  else if(code>=95) theme='storm';
  else if(code>=51 && code<=82) theme='rain';
  body.classList.add(`weather-${theme}`);
  body.dataset.weatherTheme=theme;
}
function fmtTemp(c){ if(c == null || Number.isNaN(c)) return '—'; return unit==='C' ? `${Math.round(c)}°C` : `${Math.round(c*9/5+32)}°F`; }
function tempNum(c){ return unit==='C' ? Math.round(c) : Math.round(c*9/5+32); }
function wind(c){ return c == null ? '—' : `${Math.round(c)} km/h`; }
function icon(name){ return `<span class="material-symbols-outlined">${name}</span>`; }
function esc(s=''){ return String(s).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function shortLocation(){ return `${currentLocation.name}, ${currentLocation.country_code || currentLocation.country?.slice(0,2)?.toUpperCase() || ''}`.replace(/, $/,''); }
function locationLine(){
  const lat = Number(currentLocation.latitude).toFixed(4);
  const lon = Number(currentLocation.longitude).toFixed(4);
  const ns = currentLocation.latitude >= 0 ? 'N' : 'S';
  const ew = currentLocation.longitude >= 0 ? 'E' : 'W';
  return `${currentLocation.admin1 || currentLocation.country || 'Region'} • ${Math.abs(lat)}° ${ns}, ${Math.abs(lon)}° ${ew} • Elev: ${Math.round(currentLocation.elevation || 0)}m`;
}

function metricCard(title, ico, value, unitText, tag, foot1, foot2, progress){
  return `<article class="panel metric-card"><div class="metric-head"><div class="metric-title">${icon(ico)}<span>${title}</span></div><span class="pill ${tag==='Heavy'||tag==='Elevated'?'cyan':tag==='Steady'?'teal':''}">${esc(tag || '')}</span></div><div class="metric-value">${esc(value)}<span>${esc(unitText||'')}</span></div>${progress!=null?`<div class="progress"><i style="width:${Math.max(0,Math.min(100,progress))}%"></i></div>`:''}<div class="metric-foot"><span>${esc(foot1||'')}</span><strong>${esc(foot2||'')}</strong></div></article>`;
}

function getHourly(){
  if(!weather?.hourly) return [];
  const now = new Date();
  const start = Math.max(0, weather.hourly.time.findIndex(t => new Date(t) >= now));
  return weather.hourly.time.slice(start, start+10).map((t,i)=>({
    time:new Date(t), temp:weather.hourly.temperature_2m[start+i], precip:weather.hourly.precipitation_probability?.[start+i] ?? 0,
    code:weather.hourly.weather_code[start+i], wind:weather.hourly.wind_speed_10m[start+i], humidity:weather.hourly.relative_humidity_2m[start+i]
  }));
}

function renderDashboard(){
  if(!weather){ app.innerHTML = loadingView(); return; }
  const c=weather.current, d=weather.daily, info=weatherInfo(c.weather_code);
  applyWeatherTheme(c.weather_code);
  const rain = c.precipitation ?? 0;
  const precipProb = weather.hourly?.precipitation_probability?.[0] ?? d.precipitation_probability_max?.[0] ?? 0;
  const aqi = air?.current?.us_aqi != null ? `${Math.round(air.current.us_aqi)} (US AQI)` : 'Unavailable';
  const uv = weather.daily?.uv_index_max?.[0] ?? null;
  const visibilityKm = c.visibility != null ? c.visibility/1000 : null;
  const chart = chartSection();
  app.innerHTML=`<div class="page stack">
<section class="panel alert-banner"><div class="alert-copy"><div class="alert-icon">${icon(c.weather_code>=95?'electric_bolt':'cloud')}</div><div><div><span class="pill ${c.weather_code>=95?'red':'cyan'}">${c.weather_code>=95?'WEATHER ALERT':'CURRENT CONDITIONS'}</span> <span class="muted tiny">Open-Meteo live forecast • ${esc(currentLocation.name)}</span></div><p>${esc(info[0])}. ${precipProb>=60?`Rain probability is ${Math.round(precipProb)}% for the current forecast period.`:'No major precipitation signal is currently indicated.'}</p></div></div><div class="alert-actions"><button class="btn" id="favorite-btn">${icon(favorite?'grade':'star')} ${favorite?'Favorited':'Favorite'}</button><button class="btn" id="export-btn">${icon('download')} Export CSV</button><button class="btn primary" data-screen-link="radar">${icon('radar')} Weather Radar</button></div></section>
<section class="hero-grid"><div class="hero-card"><div class="rain-lines"></div><div class="hero-top"><div><div class="location">${icon('location_on')}${esc(currentLocation.name)}, ${esc(currentLocation.country || '')}</div><div class="coords">${esc(locationLine())}</div></div><span class="pill ${c.weather_code>=95?'red':'teal'}"><span class="live-dot"></span> ${c.weather_code>=95?'Storm Risk':'Live Conditions'}</span></div><div class="hero-mid"><div><div><span class="temp" id="main-temp">${tempNum(c.temperature_2m)}</span><span class="temp-unit">°${unit}</span></div><div class="feels"><span class="muted">Feels like</span><strong>${fmtTemp(c.apparent_temperature)}</strong><span class="muted">•</span><span class="muted">Humidity ${Math.round(c.relative_humidity_2m)}%</span></div></div><div class="weather-icon">${icon(info[1])}${c.weather_code>=95?`<span class="material-symbols-outlined bolt">bolt</span>`:''}</div></div><div class="hero-bottom condition-box"><div class="condition-row"><span>${esc(info[0])}</span><span>${icon('umbrella')} ${Math.round(precipProb)}% Precip</span></div><div class="mini-meta"><div><span>Range (H/L)</span><strong>${fmtTemp(d.temperature_2m_max[0]).replace('°C','°').replace('°F','°')} / ${fmtTemp(d.temperature_2m_min[0]).replace('°C','°').replace('°F','°')}</strong></div><div><span>Air Quality</span><strong>${esc(aqi)}</strong></div><div><span>Updated</span><strong>${new Date(c.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</strong></div></div></div></div>
<div class="telemetry-grid">${metricCard('UV Index','wb_sunny',uv==null?'—':Math.round(uv),'',uv==null?'Unavailable':uv<3?'Low':uv<6?'Moderate':'High','Daily maximum',uv==null?'':'Sun protection',uv==null?null:Math.min(100,uv/11*100))}${metricCard('Wind','air',Math.round(c.wind_speed_10m),' km/h',`${windDirection(c.wind_direction_10m)}`,`Gusts: ${wind(c.wind_gusts_10m)}`,'10 m wind')}${metricCard('Humidity','water_drop',Math.round(c.relative_humidity_2m),'%','Current',`Dew point: ${fmtTemp(dewPoint(c))}`,'Moisture',c.relative_humidity_2m)}${metricCard('Visibility','visibility',visibilityKm==null?'—':visibilityKm.toFixed(1),' km',visibilityKm==null?'Unavailable':visibilityKm>=10?'Good':'Reduced','Current visibility','Forecast estimate',visibilityKm==null?null:Math.min(100,visibilityKm/20*100))}${metricCard('Pressure','speed',Math.round(c.pressure_msl),' hPa','Current',`Sea-level pressure`,'',null)}${metricCard('Precipitation','rainy',rain.toFixed(1),' mm',precipProb>=60?'Heavy':precipProb>=30?'Possible':'Low',`Probability: ${Math.round(precipProb)}%`,'Current hour')}${metricCard('Cloud Cover','cloud',Math.round(c.cloud_cover),'%','Sky cover','Current cloudiness','',c.cloud_cover)}${metricCard('Sunrise / Sunset','wb_twilight',formatTime(d.sunrise[0]),'',`Sunset ${formatTime(d.sunset[0])}`,'Local time','',null)}${metricCard('Daylight','light_mode',daylight(d.sunrise[0],d.sunset[0]),'', 'Local day','Sunrise / sunset','',null)}</div></section>
<section class="w-full"><div class="section-head"><div><div class="section-title">${icon('calendar_view_week')}<h2>7-Day Forecast</h2></div><p class="muted tiny">Forecast for ${esc(currentLocation.name)} • updated automatically</p></div><div class="muted tiny">${esc(weather.timezone || 'Local time')}</div></div><div class="forecast-grid">${d.time.map((date,i)=>forecastCard(date,i)).join('')}</div></section>
${chart}</div>`;
  bindDashboard(); bindChartTabs();
}

function forecastCard(date,i){
  const d=weather.daily, info=weatherInfo(d.weather_code[i]);
  const dateObj=new Date(`${date}T12:00:00`);
  const day=i===0?'Today':dateObj.toLocaleDateString([], {weekday:'short'});
  const rain=d.precipitation_probability_max?.[i] ?? 0;
  const hi=tempNum(d.temperature_2m_max[i]), lo=tempNum(d.temperature_2m_min[i]);
  return `<div class="panel forecast-card ${i===0?'today':''}"><div class="forecast-top"><span class="forecast-day">${day}</span><span class="forecast-date">${dateObj.toLocaleDateString([], {month:'short',day:'numeric'})}</span></div><div><div class="forecast-icon">${icon(info[1])}</div><div class="forecast-desc">${esc(info[0])}</div><span class="rain-chip">${Math.round(rain)}% Rain</span></div><div><div class="temps"><span>${hi}°</span><span>${lo}°</span></div><div class="tempbar"><i style="width:${Math.max(35,Math.min(95,55+rain/3))}%;margin-left:${Math.max(2,Math.min(30,lo/2))}%"></i></div><div class="wind-note">Max wind ${Math.round(d.wind_speed_10m_max[i])} km/h</div></div></div>`;
}

function chartSection(){
  const h=getHourly();
  const vals = activeMetric==='temp'?h.map(x=>x.temp):activeMetric==='precip'?h.map(x=>x.precip):activeMetric==='wind'?h.map(x=>x.wind):h.map(x=>x.humidity);
  if(!h.length) return '';
  const min=Math.min(...vals), max=Math.max(...vals), span=Math.max(1,max-min);
  const pts=vals.map((v,i)=>`${Math.round(i/(vals.length-1||1)*1000)},${Math.round(205-(v-min)/span*165)}`).join(' ');
  const path=`M ${pts.split(' ').map((p,i)=>{const [x,y]=p.split(',');return `${i?'L':'M'} ${x},${y}`}).join(' ')}`;
  const area=`${path} L 1000,230 L 0,230 Z`;
  const labels={temp:'Temperature (°C)',precip:'Precipitation (%)',wind:'Wind Speed (km/h)',humidity:'Humidity (%)'};
  return `<section class="panel chart-panel"><div class="section-head"><div><div class="section-title">${icon('show_chart')}<h2>24-Hour Weather Trend</h2></div><p class="muted tiny">Hourly forecast for ${esc(currentLocation.name)}</p></div><div class="chart-tabs">${Object.entries(labels).map(([k,v])=>`<button class="chart-tab ${activeMetric===k?'active':''}" data-metric="${k}">${v}</button>`).join('')}</div></div><div class="chart-wrap"><div class="grid-lines"><i></i><i></i><i></i><i></i></div><svg class="chart-svg" viewBox="0 0 1000 240" preserveAspectRatio="none"><defs><linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#4cd7f6" stop-opacity=".35"/><stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#areaGradient)"></path><path d="${path}" fill="none" stroke="#4cd7f6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path>${vals.map((v,i)=>`<circle cx="${Math.round(i/(vals.length-1||1)*1000)}" cy="${Math.round(205-(v-min)/span*165)}" r="4" fill="#acedff"/>`).join('')}</svg><div class="chart-axis">${h.map(x=>`<span>${x.time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>`).join('')}</div></div><div class="hourly">${h.map(x=>`<div class="hour"><span class="tiny muted">${x.time.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>${icon(weatherInfo(x.code)[1])}<strong>${activeMetric==='temp'?tempNum(x.temp)+'°':activeMetric==='precip'?Math.round(x.precip)+'%':activeMetric==='wind'?Math.round(x.wind)+' km/h':Math.round(x.humidity)+'%'}</strong><small>${Math.round(x.precip)}% rain</small></div>`).join('')}</div></section>`;
}

function renderRadar(){
  const w=weather?.current;
  app.innerHTML=`<div class="page stack"><div class="section-head"><div><div class="section-title">${icon('radar')}<h2>Weather Radar</h2></div><p class="muted tiny">Use radar-style precipitation activity to understand where rain and storms are developing around the selected location.</p></div><button class="btn primary" id="refresh-radar">${icon('refresh')} Refresh view</button></div><div class="screen-grid"><div class="radar-art"><div class="radar-sweep"></div><div class="radar-core"></div><div class="storm one"></div><div class="storm two"></div><div class="legend"><strong>PRECIPITATION VIEW</strong><span><i></i> Rain activity</span><span><i class="red"></i> Strong cell</span><small>Location: ${esc(currentLocation.name)}</small></div></div><div class="stack"><div class="panel" style="padding:18px"><h3>Why radar is useful</h3><div class="list" style="margin-top:12px"><div class="list-row"><div><strong>Rain timing</strong><small>See whether precipitation is approaching or moving away.</small></div><span class="pill cyan">Useful</span></div><div class="list-row"><div><strong>Storm awareness</strong><small>Identify stronger precipitation cells before going outside.</small></div><span class="pill cyan">Useful</span></div><div class="list-row"><div><strong>Short-term decisions</strong><small>Helpful for commuting, travel, outdoor plans and events.</small></div><span class="pill teal">Practical</span></div></div></div><div class="panel" style="padding:18px"><h3>Current location</h3><div class="list" style="margin-top:12px"><div class="list-row"><span>Condition</span><strong>${esc(weather?weatherInfo(w.weather_code)[0]:'—')}</strong></div><div class="list-row"><span>Rain probability</span><strong>${weather?.daily?.precipitation_probability_max?.[0] ?? 0}%</strong></div><div class="list-row"><span>Wind</span><strong>${wind(w?.wind_speed_10m)}</strong></div></div></div></div></div></div>`;
  document.getElementById('refresh-radar').onclick=()=>toast('Radar view refreshed');
}

function renderCharts(){ app.innerHTML=`<div class="page stack"><div class="section-head"><div><div class="section-title">${icon('analytics')}<h2>Forecast Analytics</h2></div><p class="muted tiny">Compare temperature, rain probability, wind and humidity for the next 24 hours.</p></div></div>${chartSection()}<div class="screen-grid"><div class="panel" style="padding:20px"><h3>Weather summary</h3><div class="list" style="margin-top:12px"><div class="list-row"><span>Current condition</span><strong>${esc(weatherInfo(weather.current.weather_code)[0])}</strong></div><div class="list-row"><span>Feels like</span><strong>${fmtTemp(weather.current.apparent_temperature)}</strong></div><div class="list-row"><span>Rain probability today</span><strong>${weather.daily.precipitation_probability_max[0]}%</strong></div></div></div><div class="panel" style="padding:20px"><h3>Location</h3><div class="list" style="margin-top:12px"><div class="list-row"><span>Place</span><strong>${esc(currentLocation.name)}</strong></div><div class="list-row"><span>Timezone</span><strong>${esc(weather.timezone || 'Local')}</strong></div></div></div></div></div>`; bindChartTabs(); }

function renderAlerts(){
  const c=weather.current,d=weather.daily, rain=d.precipitation_probability_max[0]||0;
  const alerts=[];
  if(c.weather_code>=95) alerts.push(['Thunderstorm risk',currentLocation.name,'Thunderstorm conditions are forecast for this location.','Severe']);
  if(rain>=70) alerts.push(['High rain probability',currentLocation.name,`${rain}% precipitation probability in the daily forecast.`,'High']);
  if(c.wind_gusts_10m>=45) alerts.push(['Strong wind gusts',currentLocation.name,`Gusts may reach ${Math.round(c.wind_gusts_10m)} km/h.`,'High']);
  if(!alerts.length) alerts.push(['No major alerts',currentLocation.name,'No major weather alert threshold is currently triggered by the displayed forecast.','Monitor']);
  app.innerHTML=`<div class="page stack"><div class="section-head"><div><div class="section-title">${icon('warning')}<h2>Alert Center</h2></div><p class="muted tiny">Weather conditions that may deserve attention at the selected location.</p></div><button class="btn primary" id="ack-all">Acknowledge</button></div><div class="list">${alerts.map(x=>`<article class="panel list-row"><div><strong>${esc(x[0])}</strong><small>${esc(x[1])} • ${esc(x[2])}</small></div><span class="pill ${x[3]==='Severe'?'red':x[3]==='High'?'cyan':'teal'}">${x[3]}</span></article>`).join('')}</div></div>`;
  document.getElementById('ack-all').onclick=()=>toast('Visible alerts acknowledged');
}

function renderSaved() {
  if (savedLocations.length === 0) {
    app.innerHTML = `
      <div class="page stack">
        <div class="section-head">
          <div>
            <div class="section-title">
              ${icon('bookmark')}
              <h2>Saved Places</h2>
            </div>

            <p class="muted tiny">
              Save locations you check often. Your saved places are stored
              locally in this browser.
            </p>
          </div>
        </div>

        <div class="panel empty-state">
          <span class="material-symbols-outlined">star_border</span>
          <h2>No favorite locations yet</h2>
          <p class="muted">
            Search for a city and click Favorite to save it.
          </p>
        </div>
      </div>
    `;

    return;
  }

  app.innerHTML = `
    <div class="page stack">

      <div class="section-head">
        <div>
          <div class="section-title">
            ${icon('bookmark')}
            <h2>Saved Places</h2>
          </div>

          <p class="muted tiny">
            Your favorite locations are saved locally in this browser.
          </p>
        </div>
      </div>

      <div class="forecast-grid">

        ${savedLocations.map((location, index) => `
          <button
            class="panel forecast-card ${sameLocation(location, currentLocation) ? 'today' : ''}"
            data-saved-index="${index}"
            style="border:0;color:var(--text);cursor:pointer"
          >

            <div class="forecast-top">
              <span class="forecast-day">
                ${esc(location.name)}
              </span>

              <span class="forecast-date">
                ${sameLocation(location, currentLocation)
                  ? 'Active'
                  : 'Favorite'}
              </span>
            </div>

            <div>
              <div class="forecast-icon">
                ${icon('location_on')}
              </div>

              <div class="forecast-desc">
                ${esc(location.country || '')}
              </div>
            </div>

            <div class="muted tiny">
              ${Number(location.latitude).toFixed(2)}°,
              ${Number(location.longitude).toFixed(2)}°
            </div>

          </button>
        `).join('')}

      </div>
    </div>
  `;

  document
    .querySelectorAll('[data-saved-index]')
    .forEach(button => {

      button.onclick = async () => {

        const location =
          savedLocations[Number(button.dataset.savedIndex)];

        await selectLocation(location);

        showScreen('dashboard');
      };

    });
}

function renderSettings(){
  app.innerHTML = `
  <div class="page stack">

    <div class="section-head">
      <div>
        <div class="section-title">
          ${icon('settings')}
          <h2>Configuration</h2>
        </div>

        <p class="muted tiny">
          Customize units and saved-place behavior.
        </p>
      </div>
    </div>

    <div class="panel" style="padding:20px">

      <div class="form-grid">

        <div class="field">
          <label>Temperature unit</label>

          <select id="default-unit">
            <option value="C" ${unit === 'C' ? 'selected' : ''}>
              Celsius
            </option>

            <option value="F" ${unit === 'F' ? 'selected' : ''}>
              Fahrenheit
            </option>
          </select>
        </div>

        <div class="field">
          <label>Selected location</label>

          <input
            value="${esc(currentLocation.name)}, ${esc(currentLocation.country || '')}"
            disabled
          />
        </div>

      </div>

      <button
        class="btn primary"
        id="save-settings"
        style="margin-top:18px"
      >
        ${icon('save')} Save configuration
      </button>

      <button
        class="btn"
        id="clear-local-data"
        style="margin-top:10px"
      >
        ${icon('delete')} Clear local data
      </button>

    </div>

  </div>
`;
  document.getElementById('save-settings').onclick = () => {
  unit = document.getElementById('default-unit').value;

  savePreferences();

  syncUnits();

  toast('Configuration saved');
};

  document.getElementById('clear-local-data').onclick = () => {

  const confirmed = confirm(
    'Clear your locally saved SkyLens favorites and settings?'
  );

  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);

  savedLocations = [];
  unit = 'C';
  favorite = false;
  currentLocation = { ...DEFAULT_LOCATION };

  savePreferences();

  toast('Local data cleared');

  selectLocation(DEFAULT_LOCATION);
};
}

function bindDashboard() {
  const favoriteBtn = document.getElementById('favorite-btn');

  if (favoriteBtn) {
    favoriteBtn.onclick = () => {
      favorite = !favorite;

      if (favorite) {
        // Add location if it isn't already saved
        if (!savedLocations.some(x => sameLocation(x, currentLocation))) {
          savedLocations.push({ ...currentLocation });
        }

        toast(`${currentLocation.name} added to favorites`);
      } else {
        // Remove the current location from saved locations
        savedLocations = savedLocations.filter(
          x => !sameLocation(x, currentLocation)
        );

        toast(`${currentLocation.name} removed from favorites`);
      }

      // Save everything to browser storage
      savePreferences();

      // Refresh dashboard
      renderDashboard();
    };
  }

  const exportBtn = document.getElementById('export-btn');

  if (exportBtn) {
    exportBtn.onclick = exportCSV;
  }

  document.querySelectorAll('[data-screen-link]').forEach(button => {
    button.onclick = () => showScreen(button.dataset.screenLink);
  });
}
function bindChartTabs(){ document.querySelectorAll('.chart-tab').forEach(t=>t.onclick=()=>{activeMetric=t.dataset.metric; const screen=document.querySelector('.nav-item.active')?.dataset.screen || 'dashboard'; screen==='charts'?renderCharts():renderDashboard();}); }
function exportCSV(){ if(!weather) return; const c=weather.current,d=weather.daily; const rows=[['Metric','Value'],['Location',`${currentLocation.name}, ${currentLocation.country||''}`],['Temperature',fmtTemp(c.temperature_2m)],['Feels like',fmtTemp(c.apparent_temperature)],['Humidity',`${Math.round(c.relative_humidity_2m)}%`],['Wind',wind(c.wind_speed_10m)],['Pressure',`${Math.round(c.pressure_msl)} hPa`],['Rain probability',`${d.precipitation_probability_max[0]}%`]]; const blob=new Blob([rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n')],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`skylens-${currentLocation.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.csv`; a.click(); URL.revokeObjectURL(a.href); toast('CSV exported'); }
function showScreen(screen) {
  document
    .querySelectorAll('.nav-item[data-screen]')
    .forEach(button => {
      button.classList.toggle(
        'active',
        button.dataset.screen === screen
      );
    });

  savePreferences();

  const screens = {
    dashboard: renderDashboard,
    radar: renderRadar,
    charts: renderCharts,
    alerts: renderAlerts,
    saved: renderSaved,
    settings: renderSettings
  };

  (screens[screen] || renderDashboard)();
}
function syncUnits() {
  document.querySelectorAll('.unit').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.unit === unit
    );
  });

  const topCity = document.getElementById('top-city');
  if (topCity) {
    topCity.textContent = shortLocation();
  }

  // Save the selected °C / °F preference
  savePreferences();

  renderDashboard();
}

document.getElementById('main-nav').addEventListener('click',e=>{const b=e.target.closest('[data-screen]');if(b)showScreen(b.dataset.screen)});
document.querySelector('.settings-nav').onclick=()=>showScreen('settings');
document.querySelectorAll('.unit').forEach(button => {
  button.onclick = () => {
    unit = button.dataset.unit;
    syncUnits();
  };
});
document.getElementById('auto-location').onclick=useBrowserLocation;

async function useBrowserLocation(){
  if(!navigator.geolocation){ toast('Browser location is not supported. Use the search bar instead.'); return; }
  const button=document.getElementById('auto-location');
  button.disabled=true;
  button.textContent='Locating…';
  navigator.geolocation.getCurrentPosition(async position=>{
    const {latitude, longitude, accuracy}=position.coords;
    let place={name:'Your Location',country:'',country_code:'',latitude,longitude,elevation:0,admin1:'Current location'};
    try{
      const reverse=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&zoom=10&addressdetails=1`,{headers:{'Accept':'application/json'}});
      if(reverse.ok){
        const data=await reverse.json();
        const a=data.address||{};
        place={...place,
          name:a.city||a.town||a.village||a.municipality||a.county||'Your Location',
          country:a.country||'', country_code:(a.country_code||'').toUpperCase(),
          admin1:a.state||a.region||'Current location'
        };
      }
    }catch(e){ /* Keep the coordinate-based location if reverse geocoding fails. */ }
    await selectLocation(place);
    showScreen('dashboard');
    toast(`Location updated${accuracy?` • ±${Math.round(accuracy)} m`:''}`);
    button.disabled=false;
    button.innerHTML=`${icon('my_location')} Auto`;
  }, error=>{
    const messages={1:'Location permission was denied. Allow location access in your browser, then try again.',2:'Your location could not be determined. Try again or search for a place.',3:'Location request timed out. Try again.'};
    toast(messages[error.code]||'Could not get your location.');
    button.disabled=false;
    button.innerHTML=`${icon('my_location')} Auto`;
  },{enableHighAccuracy:true,timeout:12000,maximumAge:300000});
}

document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))results.classList.add('hidden')});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus()}});
search.addEventListener('input',()=>{ clearTimeout(searchTimer); const q=search.value.trim(); if(q.length<2){results.classList.add('hidden');return;} searchTimer=setTimeout(()=>searchLocations(q),300); });

async function searchLocations(q){
  const coord=q.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if(coord){
    const lat=Number(coord[1]), lon=Number(coord[2]);
    if(lat>=-90&&lat<=90&&lon>=-180&&lon<=180){
      const place={name:`${lat.toFixed(4)}, ${lon.toFixed(4)}`,country:'Coordinates',country_code:'',latitude:lat,longitude:lon,elevation:0,admin1:'Selected point'};
      results.innerHTML=`<button class="search-result" id="coordinate-result"><span><strong>Use coordinates</strong><small>${esc(place.name)}</small></span><small>Exact point</small></button>`;
      results.classList.remove('hidden');
      document.getElementById('coordinate-result').onclick=async()=>{search.value='';results.classList.add('hidden');await selectLocation(place);showScreen('dashboard')};
      return;
    }
  }
  try{
    const res=await fetch(`${GEO_API}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`);
    if(!res.ok) throw new Error('Geocoding failed');
    const data=await res.json();
    const places=data.results||[];
    results.innerHTML=places.length?places.map((p,i)=>`<button class="search-result" data-result-index="${i}"><span><strong>${esc(p.name)}</strong><small>${esc([p.admin1,p.country].filter(Boolean).join(', '))}</small></span><small>${Number(p.latitude).toFixed(2)}°, ${Number(p.longitude).toFixed(2)}°</small></button>`).join(''):`<div class="search-result"><span>No place found. Try a city, town, country or coordinate.</span></div>`;
    results.classList.remove('hidden');
    results.querySelectorAll('[data-result-index]').forEach(b=>b.onclick=async()=>{const p=places[Number(b.dataset.resultIndex)]; search.value=''; results.classList.add('hidden'); await selectLocation(p); showScreen('dashboard');});
  }catch(e){ results.innerHTML='<div class="search-result"><span>Search is temporarily unavailable. Check your internet connection.</span></div>';results.classList.remove('hidden'); }
}

async function selectLocation(loc){
  currentLocation = { ...loc };
  savePreferences();
  app.innerHTML=loadingView();
  try{
    const params=new URLSearchParams({latitude:loc.latitude,longitude:loc.longitude,current:'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility',hourly:'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max',timezone:'auto',forecast_days:'7'});
    const aqParams=new URLSearchParams({latitude:loc.latitude,longitude:loc.longitude,current:'us_aqi',timezone:'auto'});
    const [wr,ar]=await Promise.all([fetch(`${WEATHER_API}?${params}`),fetch(`${AQ_API}?${aqParams}`)]);
    if(!wr.ok) throw new Error('Weather unavailable');
    weather=await wr.json(); air=ar.ok?await ar.json():null;
    applyWeatherTheme(weather.current.weather_code);
    document.getElementById('top-city').textContent=shortLocation();
    favorite = savedLocations.some(
      location => sameLocation(location, currentLocation)
    );
    renderDashboard();
  }catch(e){ app.innerHTML=`<div class="page"><div class="panel error-state"><span class="material-symbols-outlined">cloud_off</span><h2>Weather data unavailable</h2><p>We couldn't load weather data for ${esc(loc.name)} right now. Check your connection and try again.</p><button class="btn primary" id="retry-weather">Try again</button></div></div>`; document.getElementById('retry-weather').onclick=()=>selectLocation(loc); }
}

function sameLocation(a,b){return Math.abs(Number(a.latitude)-Number(b.latitude))<0.01&&Math.abs(Number(a.longitude)-Number(b.longitude))<0.01;}
function windDirection(deg){ if(deg==null)return '—'; const dirs=['N','NE','E','SE','S','SW','W','NW']; return dirs[Math.round(deg/45)%8]; }
function dewPoint(c){const T=Number(c.temperature_2m), RH=Number(c.relative_humidity_2m); if(!Number.isFinite(T)||!Number.isFinite(RH))return null; const a=17.62,b=243.12; const g=Math.log(RH/100)+(a*T)/(b+T); return (b*g)/(a-g);}
function formatTime(s){return s?new Date(s).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'—';}
function daylight(a,b){if(!a||!b)return '—'; const mins=Math.round((new Date(b)-new Date(a))/60000); return `${Math.floor(mins/60)}h ${mins%60}m`;}
function loadingView(){return `<div class="page"><div class="panel loading"><span class="material-symbols-outlined spin">sync</span><h2>Loading weather…</h2><p class="muted">Fetching current conditions and the 7-day forecast.</p></div></div>`;}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2200)}
function tick(){document.getElementById('utc-time').textContent=new Date().toISOString().slice(11,19)+' UTC'}
setInterval(tick,1000); tick();
selectLocation(currentLocation);
