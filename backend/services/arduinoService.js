/**
 * WMO Weather Interpretation Codes → human-readable label
 * https://open-meteo.com/en/docs#weathervariables
 */
const WMO_DESCRIPTIONS = {
  0: 'Clear Sky',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Icy Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  61: 'Light Rain',
  63: 'Moderate Rain',
  65: 'Heavy Rain',
  71: 'Light Snow',
  73: 'Moderate Snow',
  75: 'Heavy Snow',
  77: 'Snow Grains',
  80: 'Light Showers',
  81: 'Showers',
  82: 'Heavy Showers',
  85: 'Light Snow Showers',
  86: 'Snow Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm w/ Hail',
  99: 'Heavy Thunderstorm',
};

const WMO_ICONS = {
  0: '☀️',  1: '🌤️',  2: '⛅',  3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌧️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️',
  80: '🌦️', 81: '🌧️', 82: '⛈️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

function getDescription(code) {
  return WMO_DESCRIPTIONS[code] || 'Clear';
}

function getIcon(code) {
  return WMO_ICONS[code] || '🌡️';
}

/**
 * Format raw weather API response + location info into a complete weather model.
 *
 * @param {Object} rawWeather Raw payload from Open-Meteo
 * @param {{ city: string, state?: string, country: string, countryCode?: string }} location
 * @returns {Object} Normalized weather object
 */
function formatWeather(rawWeather, location = {}) {
  const c    = (rawWeather && rawWeather.current) ? rawWeather.current : {};
  const code = (c.weather_code !== undefined && c.weather_code !== null) ? Number(c.weather_code) : 0;

  const lat = (rawWeather && rawWeather.latitude !== undefined) ? Number(rawWeather.latitude) : 0;
  const lng = (rawWeather && rawWeather.longitude !== undefined) ? Number(rawWeather.longitude) : 0;

  const tempVal = c.temperature_2m !== undefined ? Number(c.temperature_2m) : 0;
  const feelsVal = c.apparent_temperature !== undefined ? Number(c.apparent_temperature) : tempVal;
  const humVal = c.relative_humidity_2m !== undefined ? Number(c.relative_humidity_2m) : 0;
  const windVal = c.wind_speed_10m !== undefined ? Number(c.wind_speed_10m) : 0;
  const pressureVal = c.surface_pressure !== undefined ? Number(c.surface_pressure) : 1013;

  return {
    city:          location.city || 'Unknown City',
    state:         location.state || '',
    country:       location.country || 'Unknown Country',
    countryCode:   location.countryCode || '',
    latitude:      lat,
    longitude:     lng,
    temperature:   Math.round(tempVal),
    feelsLike:     Math.round(feelsVal),
    humidity:      Math.max(0, Math.min(100, Math.round(humVal))),
    windSpeed:     Math.max(0, Math.round(windVal)),
    windDirection: Math.round(c.wind_direction_10m || 0),
    pressure:      Math.round(pressureVal),
    cloudCover:    Math.round(c.cloud_cover || 0),
    precipitation: Number(c.precipitation || 0),
    weatherCode:   code,
    description:   getDescription(code),
    icon:          getIcon(code),
    timezone:      rawWeather.timezone || 'UTC',
    updatedAt:     c.time || new Date().toISOString(),
  };
}

/**
 * Build the exact 6-field pipe-delimited serial payload for Arduino Uno:
 * CITY|COUNTRY|TEMP_C|WMO_CODE|HUMIDITY|WIND_KMH
 *
 * Example: NEW DELHI|INDIA|28|0|49|4
 *
 * Requirements:
 * - Upper case
 * - No pipe or newline characters in field values
 * - Safe length for 16×2 LCD line scrolling
 */
function buildSerialMessage(weather) {
  // Strip pipes and newlines from city & country
  const rawCity    = String(weather.city || 'UNKNOWN').replace(/[|\r\n]/g, ' ').trim() || 'UNKNOWN';
  const rawCountry = String(weather.country || 'UNKNOWN').replace(/[|\r\n]/g, ' ').trim() || 'UNKNOWN';

  // Truncate to maximum 24 characters to fit neatly into Arduino scroll buffers
  const city    = rawCity.toUpperCase().substring(0, 24);
  const country = rawCountry.toUpperCase().substring(0, 24);

  const temp = isNaN(weather.temperature) ? 0 : Math.round(weather.temperature);
  const code = isNaN(weather.weatherCode) ? 0 : parseInt(weather.weatherCode, 10);
  const hum  = isNaN(weather.humidity) ? 0 : Math.round(weather.humidity);
  const wind = isNaN(weather.windSpeed) ? 0 : Math.round(weather.windSpeed);

  return `${city}|${country}|${temp}|${code}|${hum}|${wind}`;
}

module.exports = {
  formatWeather,
  buildSerialMessage,
  getDescription,
  getIcon,
};
