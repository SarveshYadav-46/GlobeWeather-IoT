import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Thermometer, Droplets, Wind, MapPin, Clock,
  Navigation, Cloud, ArrowUp, Gauge
} from 'lucide-react';

// ── Wind direction helper ──────────────────────────────────────────────────────
function windDir(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8] || '—';
}

// ── Format time ────────────────────────────────────────────────────────────────
function formatTime(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

// ── Stat pill ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, unit, color = 'blue' }) {
  const colors = {
    blue:   'text-blue-400  bg-blue-500/10  border-blue-500/20',
    cyan:   'text-cyan-400  bg-cyan-500/10  border-cyan-500/20',
    green:  'text-green-400 bg-green-500/10 border-green-500/20',
    amber:  'text-amber-400 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  };
  return (
    <div className={`stat-card border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={colors[color].split(' ')[0]} />
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-slate-100">
        {value}<span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>
      </p>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
function WeatherSkeleton() {
  return (
    <div className="glass p-6 space-y-4">
      <div className="skeleton h-6 w-32" />
      <div className="skeleton h-12 w-24" />
      <div className="skeleton h-4 w-48" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    </div>
  );
}

// ── Main WeatherCard ───────────────────────────────────────────────────────────
export default function WeatherCard({ weather, loading, arduinoSent }) {
  if (loading) return <WeatherSkeleton />;

  if (!weather) {
    return (
      <div className="glass p-8 text-center">
        <div className="text-5xl mb-4">🌍</div>
        <p className="text-slate-300 font-medium">Select a location</p>
        <p className="text-slate-500 text-sm mt-1">
          Click on the globe or search for a city to get live weather
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${weather.city}-${weather.updatedAt}`}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="glass p-6 space-y-5"
      >
        {/* ── Location header ────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-blue-400 shrink-0" />
              <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
                {[weather.state, weather.country].filter(Boolean).join(', ')}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white leading-tight">
              {weather.city}
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-1">
              {Number(weather.latitude).toFixed(4)}°,{' '}
              {Number(weather.longitude).toFixed(4)}°
            </p>
          </div>

          {/* Arduino sent badge */}
          {arduinoSent !== undefined && (
            <div className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
              ${arduinoSent
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-slate-700/40 text-slate-500 border-slate-600/20'}
            `}>
              <span className={`w-1.5 h-1.5 rounded-full ${arduinoSent ? 'bg-green-400' : 'bg-slate-500'}`} />
              {arduinoSent ? 'LCD Updated' : 'LCD Offline'}
            </div>
          )}
        </div>

        {/* ── Temperature + icon ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-5 py-2 border-y border-white/5">
          <div className="weather-icon-large">{weather.icon}</div>
          <div>
            <div className="flex items-start">
              <span className="text-6xl font-black text-white leading-none">
                {weather.temperature}
              </span>
              <span className="text-2xl text-blue-400 mt-2 font-bold">°C</span>
            </div>
            <p className="text-slate-300 text-sm font-medium">{weather.description}</p>
            <p className="text-slate-500 text-xs mt-0.5">
              Feels like {weather.feelsLike}°C
            </p>
          </div>
        </div>

        {/* ── Stats grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Droplets}    label="Humidity"    value={weather.humidity}    unit="%" color="cyan" />
          <StatCard icon={Wind}        label="Wind"        value={weather.windSpeed}   unit="km/h" color="blue" />
          <StatCard icon={Gauge}       label="Pressure"    value={weather.pressure}    unit="hPa" color="purple" />
          <StatCard icon={Cloud}       label="Cloud Cover" value={weather.cloudCover}  unit="%" color="green" />
        </div>

        {/* ── Wind direction ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 text-sm">
          <Navigation
            size={16}
            className="text-blue-400"
            style={{ transform: `rotate(${weather.windDirection || 0}deg)` }}
          />
          <span className="text-slate-400">
            Wind from <span className="text-slate-200 font-medium">
              {windDir(weather.windDirection || 0)}
            </span>{' '}
            · {weather.windDirection || 0}°
          </span>
        </div>

        {/* ── Footer: last updated ───────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1 border-t border-white/5">
          <Clock size={11} />
          <span>Updated {formatTime(weather.updatedAt)} ({weather.timezone})</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
