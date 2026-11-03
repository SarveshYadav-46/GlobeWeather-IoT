import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';
import { searchCities } from '../services/weatherService';

export default function SearchBar({ onCitySelect }) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [isOpen, setIsOpen]         = useState(false);
  const [error, setError]           = useState('');
  const debounceRef                 = useRef(null);
  const containerRef                = useRef(null);

  // ── Debounced search ───────────────────────────────────────────────────────
  const handleInput = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    setError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchCities(val.trim());
        setResults(res);
        setIsOpen(true);
      } catch {
        setError('Search unavailable. Check your connection.');
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  // ── Select city ────────────────────────────────────────────────────────────
  const handleSelect = useCallback((city) => {
    setQuery(city.name);
    setIsOpen(false);
    setResults([]);
    if (onCitySelect) onCitySelect(city);
  }, [onCitySelect]);

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setIsOpen(false); }
  };

  const clearInput = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search input */}
      <div className="relative flex items-center">
        <Search
          size={18}
          className="absolute left-4 text-blue-400 pointer-events-none z-10"
        />
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Search city or country…"
          className="
            w-full h-12 pl-11 pr-12
            bg-[rgba(13,27,46,0.8)] backdrop-blur-xl
            border border-[rgba(59,130,246,0.25)] rounded-2xl
            text-slate-100 placeholder-slate-500
            text-sm font-medium
            focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
            transition-all duration-200
          "
        />
        {loading && (
          <Loader2 size={18} className="absolute right-4 text-blue-400 animate-spin" />
        )}
        {!loading && query && (
          <button onClick={clearInput} className="absolute right-4 text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-red-400 px-2">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="search-dropdown glass-strong shadow-2xl">
          {results.map((city, idx) => (
            <button
              key={`${city.id || idx}`}
              onClick={() => handleSelect(city)}
              className="
                w-full flex items-start gap-3 px-4 py-3
                hover:bg-blue-500/10 transition-colors duration-150
                border-b border-white/5 last:border-0
                text-left
              "
            >
              <MapPin size={15} className="mt-0.5 text-blue-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-100">{city.name}</p>
                <p className="text-xs text-slate-400">
                  {[city.admin1, city.country].filter(Boolean).join(', ')}
                  {city.elevation ? ` · ${Math.round(city.elevation)}m` : ''}
                </p>
              </div>
              <span className="ml-auto text-xs text-slate-600 font-mono">
                {city.latitude?.toFixed(2)}°, {city.longitude?.toFixed(2)}°
              </span>
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {isOpen && !loading && results.length === 0 && query.length >= 2 && (
        <div className="search-dropdown glass-strong px-4 py-3 text-sm text-slate-500">
          No cities found for "{query}"
        </div>
      )}
    </div>
  );
}
