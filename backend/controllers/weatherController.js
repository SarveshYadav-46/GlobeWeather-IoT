const weatherSvc = require('../services/weatherService');
const arduinoSvc = require('../services/arduinoService');
const serial     = require('../config/serial');

// In-memory cache for the last selected location
let lastSelected = null;

/**
 * GET /api/weather/search?q=London
 */
async function searchCities(req, res) {
  const query = (req.query.q || '').trim();
  if (!query || query.length < 2) {
    return res.status(400).json({
      error: 'Search query must be at least 2 characters long.',
    });
  }

  try {
    const results = await weatherSvc.searchCities(query);
    res.json({ results });
  } catch (err) {
    console.error('❌ [searchCities Error]', err.message);
    res.status(502).json({
      error: 'City search service is currently unavailable.',
      details: err.message,
    });
  }
}

/**
 * GET /api/weather/current?lat=...&lng=...
 */
async function getCurrentWeather(req, res) {
  const latRaw = req.query.lat ?? req.query.latitude;
  const lngRaw = req.query.lng ?? req.query.longitude;

  if (latRaw === undefined || lngRaw === undefined || latRaw === null || lngRaw === null) {
    return res.status(400).json({ error: 'Both latitude and longitude parameters are required.' });
  }

  const latitude  = parseFloat(latRaw);
  const longitude = parseFloat(lngRaw);

  if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({
      error: 'Invalid coordinates. Latitude must be between -90 and 90, and longitude between -180 and 180.',
    });
  }

  try {
    let location;
    if (req.query.city && req.query.country) {
      location = {
        city:        String(req.query.city).trim(),
        state:       String(req.query.state || '').trim(),
        country:     String(req.query.country).trim(),
        countryCode: (req.query.countryCode || '').trim().toUpperCase(),
      };
    } else {
      location = await weatherSvc.reverseGeocode(latitude, longitude);
    }

    const raw     = await weatherSvc.getCurrentWeather(latitude, longitude);
    const weather = arduinoSvc.formatWeather(raw, location);
    res.json({ weather });
  } catch (err) {
    console.error('❌ [getCurrentWeather Error]', err.message);
    res.status(502).json({
      error: 'Weather service is currently unavailable.',
      details: err.message,
    });
  }
}

/**
 * POST /api/location/select
 *
 * Core handler when a location is clicked on the 3D globe or selected via search.
 * 1. Identifies coordinates and location info (reverse geocodes if needed).
 * 2. Fetches real-time weather from Open-Meteo.
 * 3. Sends formatted CITY|COUNTRY|TEMP|WMO|HUM|WIND string to Arduino via COM3 serial.
 * 4. Returns complete weather & Arduino status to the frontend.
 */
async function selectLocation(req, res) {
  const body = req.body || {};
  const latRaw = body.latitude ?? body.lat;
  const lngRaw = body.longitude ?? body.lng;

  if (latRaw === undefined || lngRaw === undefined || latRaw === null || lngRaw === null) {
    console.warn('⚠️ [selectLocation] Missing coordinates in request body:', body);
    return res.status(400).json({
      error: 'Coordinates required. Please provide latitude and longitude.',
    });
  }

  const lat = parseFloat(latRaw);
  const lng = parseFloat(lngRaw);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.warn(`⚠️ [selectLocation] Invalid coordinates: (${latRaw}, ${lngRaw})`);
    return res.status(400).json({
      error: 'Invalid coordinates range. Latitude must be between -90 and 90, and longitude between -180 and 180.',
    });
  }

  console.log(`\n📍 [selectLocation] Location selected at (${lat.toFixed(4)}, ${lng.toFixed(4)})`);

  try {
    let location = {
      city:        body.city ? String(body.city).trim() : '',
      state:       body.state ? String(body.state).trim() : '',
      country:     body.country ? String(body.country).trim() : '',
      countryCode: body.countryCode ? String(body.countryCode).trim().toUpperCase() : '',
    };

    // 1. Reverse Geocode if city or country is missing (globe click)
    if (!location.city || !location.country) {
      console.log(`🔍 [selectLocation] Resolving location via reverse geocoding…`);
      try {
        const geo = await weatherSvc.reverseGeocode(lat, lng);
        location.city        = location.city || geo.city;
        location.state       = location.state || geo.state;
        location.country     = location.country || geo.country;
        location.countryCode = location.countryCode || geo.countryCode;
      } catch (geoErr) {
        console.warn('⚠️ [selectLocation] Reverse geocoding fallback triggered:', geoErr.message);
        const latStr = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
        const lngStr = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
        location.city    = location.city || `${latStr}, ${lngStr}`;
        location.country = location.country || 'Coordinates';
      }
    }

    console.log(`📌 [selectLocation] Location identified: ${location.city}${location.state ? ', ' + location.state : ''}, ${location.country}`);

    // 2. Fetch live weather from Open-Meteo
    console.log(`🌤️ [selectLocation] Fetching live weather from Open-Meteo for (${lat}, ${lng})…`);
    let rawWeather;
    try {
      rawWeather = await weatherSvc.getCurrentWeather(lat, lng);
    } catch (weatherErr) {
      console.error('❌ [selectLocation] Weather API error:', weatherErr.message);
      return res.status(502).json({
        error: 'Unable to fetch weather data from Open-Meteo.',
        details: weatherErr.message,
      });
    }

    // 3. Normalize weather object
    const weather = arduinoSvc.formatWeather(rawWeather, location);
    console.log(`🌡️ [selectLocation] Weather: ${weather.temperature}°C, ${weather.description}, Humidity: ${weather.humidity}%, Wind: ${weather.windSpeed} km/h`);

    // Cache the last selected location
    lastSelected = { ...weather, selectedAt: new Date().toISOString() };

    // 4. Build Arduino serial payload: CITY|COUNTRY|TEMP_C|WMO_CODE|HUMIDITY|WIND_KMH
    const serialMsg         = arduinoSvc.buildSerialMessage(weather);
    let arduinoSent         = false;
    let arduinoAcknowledged = false;
    let arduinoAck          = null;
    let arduinoError        = null;
    let duplicateSkipped    = false;

    console.log(`📟 [selectLocation] Preparing serial message for Arduino: "${serialMsg}"`);

    // 5. Transmit to Arduino Uno (COM3, 9600 baud)
    try {
      const ackRes = await serial.sendToArduino(serialMsg);
      if (ackRes.duplicate) {
        duplicateSkipped    = true;
        arduinoSent         = false;
        arduinoAcknowledged = true;
        arduinoAck          = 'CACHED';
        console.log(`ℹ️ [selectLocation] Duplicate location: serial re-transmission suppressed.`);
      } else {
        arduinoSent         = true;
        arduinoAcknowledged = true;
        arduinoAck          = ackRes.ack || 'ACK';
        console.log(`✅ [selectLocation] Arduino successfully acknowledged (ACK received)!`);
      }
    } catch (serialErr) {
      arduinoError = serialErr.message;
      console.warn(`⚠️ [selectLocation] Arduino transmission issue: ${serialErr.message}`);
      // Do not block the response; React UI still displays the weather!
    }

    // 6. Return response to frontend
    res.json({
      success: true,
      weather,
      arduino: {
        sent:         arduinoSent,
        acknowledged: arduinoAcknowledged,
        ack:          arduinoAck,
        message:      serialMsg,
        duplicate:    duplicateSkipped,
        error:        arduinoError,
      },
    });

  } catch (err) {
    console.error('❌ [selectLocation Critical Error]', err);
    res.status(500).json({
      error: 'Failed to process location selection.',
      details: err.message,
    });
  }
}

/**
 * GET /api/arduino/status
 */
function arduinoStatus(req, res) {
  res.json(serial.getStatus());
}

/**
 * POST /api/arduino/reconnect
 */
async function arduinoReconnect(req, res) {
  try {
    const status = await serial.reconnectSerial();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/arduino/test
 * Directly sends a 6-field test payload to Arduino.
 * Body: { message: "NEW DELHI|INDIA|28|0|49|4" }
 */
async function arduinoTest(req, res) {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      error: 'Message string required in body.',
      expected: 'CITY|COUNTRY|TEMP|WMO_CODE|HUMIDITY|WIND',
    });
  }

  const trimmed = message.trim();
  const pipes   = (trimmed.match(/\|/g) || []).length;
  if (pipes !== 5) {
    return res.status(400).json({
      error: `Message must contain exactly 6 pipe-delimited fields (found ${pipes + 1}).`,
      expected: 'CITY|COUNTRY|TEMP|WMO_CODE|HUMIDITY|WIND',
    });
  }

  try {
    const result = await serial.sendToArduino(trimmed);
    res.json({
      sent:         true,
      acknowledged: true,
      ack:          result.ack || 'ACK',
      message:      trimmed,
    });
  } catch (err) {
    res.status(503).json({
      sent:         false,
      acknowledged: false,
      error:        err.message,
    });
  }
}

/**
 * GET /api/weather/selected
 */
function getSelected(req, res) {
  if (!lastSelected) {
    return res.status(404).json({ error: 'No location selected yet.' });
  }
  res.json({ weather: lastSelected });
}

module.exports = {
  searchCities,
  getCurrentWeather,
  selectLocation,
  arduinoStatus,
  arduinoReconnect,
  arduinoTest,
  getSelected,
};
