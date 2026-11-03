const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/weatherController');

// ── Weather & Geocoding Endpoints ─────────────────────────────────────────────
router.get('/weather/search',    ctrl.searchCities);
router.get('/weather/current',   ctrl.getCurrentWeather);
router.get('/weather/selected',  ctrl.getSelected);

// ── Location Selection Endpoint (triggers Open-Meteo & Arduino USB Serial) ────
router.post('/location/select',  ctrl.selectLocation);

// ── Arduino Hardware Management Endpoints ─────────────────────────────────────
router.get('/arduino/status',    ctrl.arduinoStatus);
router.post('/arduino/reconnect', ctrl.arduinoReconnect);
router.post('/arduino/test',     ctrl.arduinoTest);

module.exports = router;
