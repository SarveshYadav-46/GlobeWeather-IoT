import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Search for cities matching a query string.
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchCities(query) {
  try {
    const { data } = await api.get('/weather/search', { params: { q: query } });
    return data.results || [];
  } catch (err) {
    console.error('[weatherService searchCities]', err);
    throw err;
  }
}

/**
 * Fetch weather for a specific lat/lng, optionally pass known city/country.
 */
export async function getWeather(lat, lng, city = '', country = '', countryCode = '') {
  try {
    const { data } = await api.get('/weather/current', {
      params: { lat, lng, city, country, countryCode },
    });
    return data.weather;
  } catch (err) {
    console.error('[weatherService getWeather]', err);
    throw err;
  }
}

/**
 * Select a location: fetches weather from Open-Meteo + transmits to Arduino Uno via serial.
 * @param {{ latitude: number, longitude: number, city?: string, state?: string, country?: string, countryCode?: string }} payload
 */
export async function selectLocation(payload) {
  try {
    const { data } = await api.post('/location/select', payload);
    return data;
  } catch (err) {
    console.error('[weatherService selectLocation]', err);
    throw err;
  }
}

/**
 * Get live Arduino connection and serial transmission status.
 */
export async function getArduinoStatus() {
  try {
    const { data } = await api.get('/arduino/status');
    return data;
  } catch (err) {
    console.warn('[weatherService getArduinoStatus] Status check failed:', err.message);
    return {
      connected: false,
      ready: false,
      port: 'COM3',
      baudRate: 9600,
      lastError: 'Backend unreachable or disconnected',
    };
  }
}

/**
 * Trigger manual serial reconnection to Arduino.
 */
export async function reconnectArduino() {
  try {
    const { data } = await api.post('/arduino/reconnect');
    return data.status;
  } catch (err) {
    console.error('[weatherService reconnectArduino]', err);
    throw err;
  }
}

/**
 * Send a test string directly to Arduino.
 * @param {string} message E.g. "NEW DELHI|INDIA|28|0|49|4"
 */
export async function testArduino(message) {
  try {
    const { data } = await api.post('/arduino/test', { message });
    return data;
  } catch (err) {
    console.error('[weatherService testArduino]', err);
    throw err;
  }
}

/**
 * Get the last selected city's weather.
 */
export async function getLastSelected() {
  try {
    const { data } = await api.get('/weather/selected');
    return data.weather;
  } catch (err) {
    console.warn('[weatherService getLastSelected]', err.message);
    return null;
  }
}
