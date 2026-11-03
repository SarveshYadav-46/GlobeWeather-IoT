import React, { useState, useEffect } from 'react';
import { Globe2, Home, Compass, CloudSun, Cpu, Menu, X } from 'lucide-react';
import { getArduinoStatus } from '../services/weatherService';

const NAV_ITEMS = [
  { label: 'Home',    icon: Home,     section: 'home' },
  { label: 'Explore', icon: Compass,  section: 'explore' },
  { label: 'Weather', icon: CloudSun, section: 'weather' },
  { label: 'Device',  icon: Cpu,      section: 'device' },
];

export default function Navbar({ activeSection, onNav }) {
  const [menuOpen, setMenuOpen]     = useState(false);
  const [arduinoOk, setArduinoOk]  = useState(null);

  // Poll Arduino status for navbar badge
  useEffect(() => {
    const check = async () => {
      try {
        const s = await getArduinoStatus();
        setArduinoOk(s.connected);
      } catch {
        setArduinoOk(false);
      }
    };
    check();
    const t = setInterval(check, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="glass-strong mx-4 mt-3 px-5 py-3 flex items-center gap-4 shadow-xl">

        {/* ── Logo ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 mr-4">
          <div className="relative">
            <Globe2 size={26} className="text-blue-400 animate-spin-slow" />
          </div>
          <div>
            <span className="text-white font-black text-lg tracking-tight" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Globe<span className="gradient-text">Weather</span>
            </span>
          </div>
        </div>

        {/* ── Desktop nav ───────────────────────────────────────────────────── */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_ITEMS.map(({ label, icon: Icon, section }) => (
            <button
              key={section}
              onClick={() => onNav?.(section)}
              className={`nav-link flex items-center gap-1.5 ${activeSection === section ? 'active' : ''}`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        {/* ── Arduino badge ─────────────────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <div className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border
            transition-all duration-500
            ${arduinoOk === null
              ? 'bg-slate-700/30 text-slate-500 border-slate-600/20'
              : arduinoOk
                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'}
          `}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              arduinoOk === null ? 'bg-slate-500' : arduinoOk ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`} />
            <Cpu size={11} />
            {arduinoOk === null ? 'Checking…' : arduinoOk ? 'Arduino OK' : 'No Device'}
          </div>
        </div>

        {/* ── Mobile menu toggle ────────────────────────────────────────────── */}
        <button
          className="md:hidden ml-auto text-slate-400 hover:text-white transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── Mobile dropdown ───────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="glass-strong mx-4 mt-1 p-3 flex flex-col gap-1 shadow-xl md:hidden">
          {NAV_ITEMS.map(({ label, icon: Icon, section }) => (
            <button
              key={section}
              onClick={() => { onNav?.(section); setMenuOpen(false); }}
              className={`nav-link flex items-center gap-2 ${activeSection === section ? 'active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
