import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Wifi, WifiOff, Usb, Clock, MapPin, AlertCircle, RefreshCw, Activity, ArrowRight } from 'lucide-react';
import { getArduinoStatus } from '../services/weatherService';

const POLL_INTERVAL_MS = 4000;

export default function DeviceStatus({ onOpenFullView }) {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getArduinoStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const connected = Boolean(status?.connected);

  return (
    <div className="glass p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-purple-400" />
          <span className="text-sm font-semibold text-slate-200">Arduino Device Status</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title="Refresh device status"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          {onOpenFullView && (
            <button
              onClick={onOpenFullView}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
            >
              Details <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Connection badge (confirmed open, not just configured) */}
      <motion.div
        key={connected ? 'connected' : 'disconnected'}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`
          flex items-center gap-3 p-3 rounded-xl border transition-all duration-300
          ${connected
            ? 'bg-green-500/10 border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
            : 'bg-red-500/10 border-red-500/20'}
        `}
      >
        <div className="relative">
          {connected ? (
            <>
              <Wifi size={20} className="text-green-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
            </>
          ) : (
            <WifiOff size={20} className="text-red-400" />
          )}
        </div>
        <div>
          <p className={`text-sm font-bold ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'CONNECTED (COM3)' : 'DISCONNECTED'}
          </p>
          <p className="text-xs text-slate-400">
            {connected ? '16×2 I2C LCD & LED Ready' : 'Arduino port closed'}
          </p>
        </div>
      </motion.div>

      {/* Details list */}
      <div className="space-y-2 text-xs">
        {/* Port & Baud */}
        <div className="flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <Usb size={12} className="text-blue-400 shrink-0" />
            <span>Port:</span>
          </div>
          <span className="text-slate-200 font-mono font-medium">
            {status?.port || 'COM3'} @ {status?.baudRate || 9600} baud
          </span>
        </div>

        {/* Last transmitted location */}
        <div className="flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <MapPin size={12} className="text-cyan-400 shrink-0" />
            <span>Last Location:</span>
          </div>
          <span className="text-cyan-300 font-medium truncate max-w-[170px]">
            {status?.lastLocation || status?.lastCity || '—'}
          </span>
        </div>

        {/* Arduino ACK Status */}
        <div className="flex items-center justify-between text-slate-400">
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-purple-400 shrink-0" />
            <span>Arduino ACK:</span>
          </div>
          <span className={`font-mono font-bold ${
            status?.lastAck?.success ? 'text-green-400' : status?.lastAck ? 'text-amber-400' : 'text-slate-500'
          }`}>
            {status?.lastAck?.status || 'Waiting…'}
          </span>
        </div>

        {/* Last sent time */}
        {status?.lastSentAt && (
          <div className="flex items-center justify-between text-slate-400">
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-green-400 shrink-0" />
              <span>Last Sent:</span>
            </div>
            <span className="text-slate-300 font-mono">
              {new Date(status.lastSentAt).toLocaleTimeString()}
            </span>
          </div>
        )}

        {/* Error notice */}
        {status?.lastError && !connected && (
          <div className="flex items-start gap-2 text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 mt-2">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed break-all">{status.lastError}</span>
          </div>
        )}
      </div>

      {/* Mini LCD preview */}
      {connected && status?.lastCity && (
        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">
            LCD Screen 1 Preview
          </p>
          <div
            className="rounded-lg p-2.5 font-mono text-[11px] leading-5 text-green-400 shadow-inner"
            style={{
              background: '#0d1d05',
              border: '2px solid #1f3b0e',
              letterSpacing: '0.04em',
            }}
          >
            <div className="truncate">CITY: {status.lastCity}</div>
            <div className="truncate opacity-75">COUNTRY: {status.lastLocation?.split(',')[1]?.trim() || '—'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
