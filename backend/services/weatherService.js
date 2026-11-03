const axios = require('axios');

const GEOCODING_BASE        = 'https://geocoding-api.open-meteo.com/v1';
const WEATHER_BASE          = 'https://api.open-meteo.com/v1';
const ENSEMBLE_WEATHER_BASE = 'https://ensemble-api.open-meteo.com/v1';
const REVERSE_GEO_BASE      = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const AXIOS_HEADERS = {
  'User-Agent': 'GlobeWeather/1.0 (Interactive 3D Globe IoT)',
  Accept: 'application/json',
};

/**
 * Format coordinate strings into readable latitude/longitude representations.
 */
function formatCoordStrings(lat, lng) {
  const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
  return { latStr, lngStr };
}

/**
 * Search cities by name using Open-Meteo Geocoding API with Nominatim fallback.
 * @param {string} query
 * @returns {Promise<Array>} list of matching locations
 */
async function searchCities(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  // Tier 1: Open-Meteo Geocoding
  try {
    const { data } = await axios.get(`${GEOCODING_BASE}/search`, {
      params: {
        name: trimmed,
        count: 10,
        language: 'en',
        format: 'json',
      },
      headers: AXIOS_HEADERS,
      timeout: 8000,
    });

    if (data && Array.isArray(data.results) && data.results.length > 0) {
      console.log(`🔍 [Search] Open-Meteo found ${data.results.length} results for "${trimmed}"`);
      return data.results.map((item) => ({
        id:           item.id,
        name:         item.name,
        latitude:     item.latitude,
        longitude:    item.longitude,
        country:      item.country || '',
        country_code: (item.country_code || '').toUpperCase(),
        admin1:       item.admin1 || '',
        elevation:    item.elevation,
      }));
    }
  } catch (err) {
    console.warn(`⚠️ [Search] Open-Meteo search failed (${err.message}), trying Nominatim fallback…`);
  }

  // Tier 2: Nominatim OSM Fallback
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: trimmed,
        format: 'json',
        addressdetails: 1,
        limit: 10,
      },
      headers: {
        'User-Agent': 'GlobeWeatherApp/1.0 (Student IoT Project)',
        Accept: 'application/json',
      },
      timeout: 8000,
    });

    if (Array.isArray(data) && data.length > 0) {
      console.log(`🔍 [Search] Nominatim found ${data.length} results for "${trimmed}"`);
      return data.map((item, idx) => ({
        id:           item.place_id || idx,
        name:         item.name || (item.display_name ? item.display_name.split(',')[0].trim() : trimmed),
        latitude:     parseFloat(item.lat),
        longitude:    parseFloat(item.lon),
        country:      item.address?.country || '',
        country_code: (item.address?.country_code || '').toUpperCase(),
        admin1:       item.address?.state || item.address?.region || '',
      }));
    }
  } catch (err) {
    console.warn(`⚠️ [Search] Nominatim search also failed: ${err.message}`);
  }

  return [];
}

/**
 * Reverse geocode latitude and longitude to city, state, and country.
 * Uses BigDataCloud with Nominatim fallback.
 *
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @returns {Promise<{ city: string, state: string, country: string, countryCode: string }>}
 */
async function reverseGeocode(lat, lng) {
  const { latStr, lngStr } = formatCoordStrings(lat, lng);
  const coordLabel = `${latStr}, ${lngStr}`;

  // Default coordinate location fallback
  const defaultLocation = {
    city:        coordLabel,
    state:       '',
    country:     'Coordinates',
    countryCode: '',
  };

  // ── Tier 1: BigDataCloud Reverse Geocoding ──────────────────────────────────
  try {
    const { data } = await axios.get(REVERSE_GEO_BASE, {
      params: {
        latitude: lat,
        longitude: lng,
        localityLanguage: 'en',
      },
      headers: AXIOS_HEADERS,
      timeout: 7000,
    });

    if (data) {
      const city        = (data.city || data.locality || '').trim();
      const state       = (data.principalSubdivision || '').trim();
      const country     = (data.countryName || '').trim();
      const countryCode = (data.countryCode || '').trim().toUpperCase();

      // If we got at least a city, state, or country
      if (city || state || country) {
        return {
          city:        city || state || coordLabel,
          state:       state || '',
          country:     country || (city ? 'International Area' : 'Coordinates'),
          countryCode,
        };
      }
    }
  } catch (err) {
    console.warn(`⚠️ [ReverseGeocode] BigDataCloud failed (${err.message}). Trying Nominatim fallback…`);
  }

  // ── Tier 2: OpenStreetMap Nominatim ─────────────────────────────────────────
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'json',
        lat,
        lon: lng,
        zoom: 10,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'GlobeWeatherApp/1.0 (Student IoT Project)',
        Accept: 'application/json',
      },
      timeout: 7000,
    });

    if (data && data.address) {
      const a     = data.address;
      const city  = (a.city || a.town || a.village || a.municipality || a.county || '').trim();
      const state = (a.state || a.region || '').trim();
      const country = (a.country || '').trim();
      const countryCode = (a.country_code || '').trim().toUpperCase();

      if (city || state || country) {
        return {
          city:        city || state || coordLabel,
          state:       state || '',
          country:     country || 'Coordinates',
          countryCode,
        };
      }
    }
  } catch (err) {
    console.warn(`⚠️ [ReverseGeocode] Nominatim fallback failed: ${err.message}`);
  }

  // Fallback to formatted coordinate strings
  return defaultLocation;
}

/**
 * Map WorldWeatherOnline code (from wttr.in) to standard WMO Weather Code
 */
function mapWttrCodeToWmo(wwoCode) {
  const code = parseInt(wwoCode, 10);
  switch (code) {
    case 113: return 0;   // Clear/Sunny
    case 116: return 2;   // Partly Cloudy
    case 119: return 3;   // Cloudy
    case 122: return 3;   // Overcast
    case 143:
    case 248:
    case 260: return 45;  // Fog
    case 263:
    case 266: return 51;  // Light Drizzle
    case 281:
    case 284: return 55;  // Heavy Drizzle
    case 293:
    case 296: return 61;  // Light Rain
    case 299:
    case 302: return 63;  // Moderate Rain
    case 305:
    case 308: return 65;  // Heavy Rain
    case 311:
    case 314: return 66;  // Freezing Rain
    case 317:
    case 320: return 77;  // Snow Grains / Sleet
    case 323:
    case 326: return 71;  // Light Snow
    case 329:
    case 332: return 73;  // Moderate Snow
    case 335:
    case 338: return 75;  // Heavy Snow
    case 353:
    case 356: return 80;  // Light Showers
    case 359: return 82;  // Heavy Showers
    case 368:
    case 371: return 85;  // Snow Showers
    case 386:
    case 389: return 95;  // Thunderstorm
    case 392:
    case 395: return 96;  // Thunderstorm w/ Hail
    default:  return 1;   // Mainly Clear
  }
}

/**
 * Fetch latest real-time weather from Open-Meteo API with fallback resilience.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<Object>} Weather payload conforming to Open-Meteo schema
 */
async function getCurrentWeather(latitude, longitude) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    throw new Error('Valid numeric latitude and longitude coordinates are required.');
  }

  const currentParams = [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'weather_code',
    'wind_speed_10m',
    'wind_direction_10m',
    'surface_pressure',
    'cloud_cover',
    'precipitation',
  ].join(',');

  // ── Tier 1: Open-Meteo Forecast API ──────────────────────────────────────────
  try {
    const { data } = await axios.get(`${WEATHER_BASE}/forecast`, {
      params: {
        latitude: lat,
        longitude: lng,
        current: currentParams,
        wind_speed_unit: 'kmh',
        timezone: 'auto',
      },
      headers: AXIOS_HEADERS,
      timeout: 8000,
    });

    if (data && data.current) {
      return data;
    }
  } catch (err) {
    console.warn(`⚠️ [Weather API] Open-Meteo forecast API error: ${err.message}. Trying Ensemble fallback…`);
  }

  // ── Tier 2: Open-Meteo Ensemble API (GFS seamless) ──────────────────────────
  try {
    const { data } = await axios.get(`${ENSEMBLE_WEATHER_BASE}/ensemble`, {
      params: {
        latitude: lat,
        longitude: lng,
        current: currentParams,
        wind_speed_unit: 'kmh',
        timezone: 'auto',
        models: 'gfs_seamless',
      },
      headers: AXIOS_HEADERS,
      timeout: 8000,
    });

    if (data && data.current) {
      console.log('ℹ️ [Weather API] Using Open-Meteo Ensemble data');
      return data;
    }
  } catch (err) {
    console.warn(`⚠️ [Weather API] Open-Meteo Ensemble error: ${err.message}. Trying wttr.in fallback…`);
  }

  // ── Tier 3: wttr.in fallback ────────────────────────────────────────────────
  try {
    const { data } = await axios.get(`https://wttr.in/${lat},${lng}?format=j1`, {
      headers: {
        'User-Agent': 'GlobeWeather/1.0',
        Accept: 'application/json',
      },
      timeout: 8000,
    });

    if (data && Array.isArray(data.current_condition) && data.current_condition[0]) {
      const cc = data.current_condition[0];
      console.log('ℹ️ [Weather API] Using wttr.in fallback data');
      return {
        latitude: lat,
        longitude: lng,
        timezone: 'auto',
        current: {
          time: new Date().toISOString(),
          temperature_2m: parseFloat(cc.temp_C) || 0,
          apparent_temperature: parseFloat(cc.FeelsLikeC) || parseFloat(cc.temp_C) || 0,
          relative_humidity_2m: parseFloat(cc.humidity) || 0,
          weather_code: mapWttrCodeToWmo(cc.weatherCode),
          wind_speed_10m: parseFloat(cc.windspeedKmph) || 0,
          wind_direction_10m: parseFloat(cc.winddirDegree) || 0,
          surface_pressure: parseFloat(cc.pressure) || 1013,
          cloud_cover: parseFloat(cc.cloudcover) || 0,
          precipitation: parseFloat(cc.precipMM) || 0,
        },
      };
    }
  } catch (err) {
    console.error(`❌ [Weather API] All weather providers failed for (${lat}, ${lng}): ${err.message}`);
  }

  throw new Error(`Weather services temporarily unreachable for coordinates (${lat}, ${lng}). Please check your internet connection.`);
}

module.exports = {
  searchCities,
  reverseGeocode,
  getCurrentWeather,
};
