import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import GlobeComponent from '../components/Globe';
import SearchBar from '../components/SearchBar';
import WeatherCard from '../components/WeatherCard';
import DeviceStatus from '../components/DeviceStatus';
import { selectLocation } from '../services/weatherService';

export default function Home({ onNavigateDevice }) {
  const [weather, setWeather]         = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [arduinoSent, setArduinoSent] = useState(undefined);

  // ── Shared handler for both globe click and search select ──────────────────
  const handleLocationSelect = useCallback(async (lat, lng, city = '', country = '', countryCode = '', state = '') => {
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
      console.warn('[Home] Cannot select location with invalid coordinates:', { lat, lng });
      return;
    }

    setLoading(true);
    setError('');
    setSuccessNotice('');
    setArduinoSent(undefined);

    try {
      console.log(`[Home] Selecting location: ${city || 'Coordinates'} (${lat}, ${lng})`);
      const result = await selectLocation({
        latitude:    lat,
        longitude:   lng,
        city:        city || '',
        state:       state || '',
        country:     country || '',
        countryCode: countryCode || '',
      });

      if (result && result.weather) {
        setWeather(result.weather);
        const sent = result.arduino?.sent ?? false;
        setArduinoSent(sent);

        const cityName = result.weather.city || 'Location';
        if (result.arduino?.sent) {
          setSuccessNotice(`Weather updated for ${cityName} & sent to Arduino LCD!`);
        } else if (result.arduino?.duplicate) {
          setSuccessNotice(`Weather updated for ${cityName} (already sent to Arduino).`);
        }
      }
    } catch (err) {
      console.error('[Home handleLocationSelect Error]', err);
      const serverError   = err.response?.data?.error;
      const serverDetails = err.response?.data?.details;
      let displayMsg = 'Failed to process location. Please try again.';

      if (serverError && serverDetails && serverError !== serverDetails) {
        displayMsg = `${serverError} (${serverDetails})`;
      } else if (serverError) {
        displayMsg = serverError;
      } else if (err.message) {
        displayMsg = err.message;
      }
      setError(displayMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Handle globe click ─────────────────────────────────────────────────────
  const handleGlobeClick = useCallback((lat, lng) => {
    handleLocationSelect(lat, lng);
  }, [handleLocationSelect]);

  // ── Handle city search select ──────────────────────────────────────────────
  const handleCitySelect = useCallback((city) => {
    handleLocationSelect(
      city.latitude,
      city.longitude,
      city.name,
      city.country,
      city.country_code,
      city.admin1
    );
  }, [handleLocationSelect]);

  return (
    <div className="min-h-screen flex flex-col pt-20 pb-6 px-4 lg:px-6">

      {/* ── Error Banner ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl bg-red-900/90 border border-red-500/40 text-red-100 text-sm shadow-2xl backdrop-blur-xl max-w-[90vw]"
          >
            <AlertCircle size={18} className="text-red-400 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-3 text-red-300 hover:text-white font-bold"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Success Toast ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {successNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-900/90 border border-emerald-500/40 text-emerald-100 text-sm shadow-2xl backdrop-blur-xl"
          >
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
            <button
              onClick={() => setSuccessNotice('')}
              className="ml-3 text-emerald-300 hover:text-white font-bold"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main 2-column layout ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-5 max-w-[1600px] mx-auto w-full">

        {/* ── Left panel: 3D Globe ─────────────────────────────────────────── */}
        <div className="relative lg:flex-1 min-h-[55vh] lg:min-h-0 rounded-2xl overflow-hidden glass glow-blue">
          <GlobeComponent
            onLocationSelect={handleGlobeClick}
            selectedLocation={weather}
          />

          {/* ── Search bar overlay (top-center of globe) ───────────────────── */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[min(420px,92%)] z-20">
            <SearchBar onCitySelect={handleCitySelect} />
          </div>
        </div>

        {/* ── Right panel: Info cards ────────────────────────────────────────── */}
        <div className="lg:w-[360px] xl:w-[400px] flex flex-col gap-4">

          {/* Weather card */}
          <WeatherCard
            weather={weather}
            loading={loading}
            arduinoSent={arduinoSent}
          />

          {/* Device status widget */}
          <DeviceStatus onOpenFullView={onNavigateDevice} />

          {/* Mini instructions card (hidden after first weather load) */}
          {!weather && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass p-5 space-y-3"
            >
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">How to use</p>
              <div className="space-y-2.5 text-sm text-slate-300">
                {[
                  ['🌍', 'Click anywhere on the 3D globe to pick a location'],
                  ['🔍', 'Or search for any city or country in the search bar'],
                  ['🌤️', 'Live Open-Meteo weather updates instantly'],
                  ['📟', 'Arduino Uno receives weather via USB serial (COM3)'],
                  ['💡', 'LED on pin D6 blinks for 15s on new location'],
                  ['📺', '16×2 I2C LCD cycles through 3 weather info screens'],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <span className="text-base shrink-0">{icon}</span>
                    <span className="text-xs text-slate-400 leading-relaxed">{text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
