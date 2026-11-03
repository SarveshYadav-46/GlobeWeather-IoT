import React, { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';

// ── Earth texture URLs (NASA / public domain) ──────────────────────────────────
const EARTH_IMG   = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const BUMP_IMG    = 'https://unpkg.com/three-globe/example/img/earth-topology.png';

export default function GlobeComponent({ onLocationSelect, selectedLocation }) {
  const containerRef = useRef(null);
  const globeRef     = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [coords, setCoords]     = useState(null);

  // ── Initialize 3D Globe ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const globe = Globe()(containerRef.current)
      .globeImageUrl(EARTH_IMG)
      .bumpImageUrl(BUMP_IMG)
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .atmosphereColor('#3b82f6')
      .atmosphereAltitude(0.18)
      .pointsData([])
      .pointAltitude(0.02)
      .pointColor(() => '#38bdf8')
      .pointRadius(0.5)
      .pointLabel('label')
      // ── Safe Globe Click Handler ───────────────────────────────────────────
      .onGlobeClick((clickCoords) => {
        if (!clickCoords || typeof clickCoords.lat !== 'number' || typeof clickCoords.lng !== 'number') {
          console.warn('[Globe] Click event did not yield valid coordinates', clickCoords);
          return;
        }

        const lat = Number(clickCoords.lat.toFixed(5));
        const lng = Number(clickCoords.lng.toFixed(5));

        console.log(`[Globe] Clicked coordinates: ${lat}°, ${lng}°`);
        setCoords({ lat, lng });

        if (onLocationSelect) {
          onLocationSelect(lat, lng);
        }
      })
      // ── Click on point marker ──────────────────────────────────────────────
      .onPointClick((point) => {
        if (point && typeof point.lat === 'number' && typeof point.lng === 'number') {
          if (onLocationSelect) {
            onLocationSelect(point.lat, point.lng);
          }
        }
      })
      .onGlobeRightClick(() => {})
      .width(containerRef.current.clientWidth || 600)
      .height(containerRef.current.clientHeight || 500);

    // Auto-rotation and camera controls
    globe.controls().autoRotate      = true;
    globe.controls().autoRotateSpeed = 0.35;
    globe.controls().enableDamping   = true;
    globe.controls().dampingFactor   = 0.08;
    globe.controls().minDistance     = 110;
    globe.controls().maxDistance     = 700;

    globeRef.current = globe;

    // Load indicator
    const timer = setTimeout(() => setIsLoaded(true), 600);

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !globeRef.current) return;
      globeRef.current
        .width(containerRef.current.clientWidth)
        .height(containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      try {
        globe._destructor?.();
      } catch (_) {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update markers and camera when selectedLocation changes ─────────────────
  useEffect(() => {
    if (!globeRef.current) return;

    if (selectedLocation && typeof selectedLocation.latitude === 'number' && typeof selectedLocation.longitude === 'number') {
      const points = [{
        lat: selectedLocation.latitude,
        lng: selectedLocation.longitude,
        label: `${selectedLocation.city || 'Location'}${selectedLocation.country ? ', ' + selectedLocation.country : ''}`,
      }];
      globeRef.current.pointsData(points);

      // Smooth camera transition to the selected location
      globeRef.current.pointOfView(
        { lat: selectedLocation.latitude, lng: selectedLocation.longitude, altitude: 1.8 },
        1200
      );
    } else {
      globeRef.current.pointsData([]);
    }
  }, [selectedLocation]);

  return (
    <div className="relative w-full h-full">
      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#020817]">
          <div className="relative w-20 h-20 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
          </div>
          <p className="text-blue-400 font-medium text-sm tracking-wider animate-pulse">
            LOADING EARTH 3D…
          </p>
        </div>
      )}

      {/* Globe canvas */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-crosshair"
        style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 0.6s ease' }}
      />

      {/* Click coordinates indicator */}
      {coords && isLoaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass px-4 py-2 text-xs text-blue-300 font-mono pointer-events-none z-10 shadow-lg">
          📍 {coords.lat.toFixed(4)}°, {coords.lng.toFixed(4)}°
        </div>
      )}

      {/* Interaction hint */}
      {isLoaded && !selectedLocation && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass px-4 py-2 text-xs text-slate-300 pointer-events-none whitespace-nowrap z-10 shadow-lg">
          🖱️ Click anywhere on the 3D globe to fetch weather &amp; update LCD
        </div>
      )}
    </div>
  );
}
