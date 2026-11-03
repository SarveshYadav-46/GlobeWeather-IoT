import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu, Wifi, WifiOff, Usb, Clock, MapPin, AlertCircle,
  RefreshCw, Send, CheckCircle2, ShieldAlert, Activity, Lightbulb
} from 'lucide-react';
import { getArduinoStatus, reconnectArduino, testArduino } from '../services/weatherService';

const POLL_INTERVAL_MS = 3000;

export default function DevicePage() {
  const [status, setStatus]             = useState(null);
  const [loading, setLoading]           = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [testing, setTesting]           = useState(false);
  const [testResult, setTestResult]     = useState(null);
  const [testMsg, setTestMsg]           = useState('NEW DELHI|INDIA|28|0|49|4');
  const [lcdScreen, setLcdScreen]       = useState(0);

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

  // Simulate 16x2 LCD screen rotation every 2.5s to match Arduino code
  useEffect(() => {
    const timer = setInterval(() => {
      setLcdScreen((prev) => (prev + 1) % 3);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const handleReconnect = async () => {
    setReconnecting(true);
    setTestResult(null);
    try {
      const updated = await reconnectArduino();
      setStatus(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setReconnecting(false);
      fetchStatus();
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testArduino(testMsg);
      setTestResult({ success: true, message: `ACK Received from Arduino for "${res.message}"` });
      fetchStatus();
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || err.message || 'Arduino did not acknowledge.',
      });
    } finally {
      setTesting(false);
    }
  };

  const isConnected = Boolean(status?.connected);
  const parts = (status?.lastSentPayload || '').split('|');
  const lastCity = parts[0] || status?.lastCity || '—';
  const lastCountry = parts[1] || '—';
  const lastTemp = parts[2] || '—';
  const lastCode = parts[3] || '—';
  const lastHum = parts[4] || '—';
  const lastWind = parts[5] || '—';

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 max-w-5xl mx-auto space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Cpu className="text-blue-400" size={32} />
            Hardware &amp; Serial Device Status
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry for Arduino Uno, 16×2 I2C LCD, and USB Serial (COM3)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass hover:bg-white/10 text-slate-200 text-xs font-semibold transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleReconnect}
            disabled={reconnecting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
          >
            <Usb size={14} className={reconnecting ? 'animate-spin' : ''} />
            {reconnecting ? 'Reconnecting…' : 'Reconnect COM Port'}
          </button>
        </div>
      </div>

      {/* ── Top Status Cards Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* 1. Connection Status */}
        <div className={`glass p-5 rounded-2xl border ${
          isConnected ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Connection</span>
            <div className={`p-2 rounded-xl ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
            <span className={`text-2xl font-black ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {isConnected ? 'Serial port confirmed open & active' : 'COM3 port is closed or unavailable'}
          </p>
        </div>

        {/* 2. Serial Port Config */}
        <div className="glass p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">USB Serial Port</span>
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Usb size={20} />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {status?.port || 'COM3'}
          </p>
          <p className="text-xs text-slate-400 mt-2 flex items-center justify-between">
            <span>Baud Rate:</span>
            <span className="text-blue-300 font-mono font-bold">{status?.baudRate || 9600} bps</span>
          </p>
        </div>

        {/* 3. Arduino ACK Status */}
        <div className="glass p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Last Arduino ACK</span>
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Activity size={20} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status?.lastAck?.success ? (
              <CheckCircle2 size={18} className="text-green-400" />
            ) : status?.lastAck ? (
              <ShieldAlert size={18} className="text-amber-400" />
            ) : null}
            <span className="text-xl font-bold text-white font-mono">
              {status?.lastAck?.status || 'NO ACK YET'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2 font-mono truncate">
            {status?.lastAck?.at ? `At: ${new Date(status.lastAck.at).toLocaleTimeString()}` : 'Awaiting location selection'}
          </p>
        </div>
      </div>

      {/* ── Main Details Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Device Telemetry & Last Transmission */}
        <div className="glass p-6 rounded-2xl space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MapPin size={18} className="text-cyan-400" />
            Transmission Telemetry
          </h2>

          <div className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-slate-400">Last Transmitted Location:</span>
              <span className="text-cyan-300 font-semibold">{status?.lastLocation || status?.lastCity || 'None yet'}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-slate-400">Last Sent Timestamp:</span>
              <span className="text-slate-200 font-mono text-xs">
                {status?.lastSentAt ? new Date(status.lastSentAt).toLocaleString() : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-slate-400">Raw Serial Payload:</span>
              <span className="text-yellow-300 font-mono text-xs break-all max-w-[240px] text-right">
                {status?.lastSentPayload ? `${status.lastSentPayload}\\n` : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-slate-400">Hardware Protocol:</span>
              <span className="text-slate-300 font-mono text-xs">CITY|COUNTRY|TEMP|WMO|HUM|WIND\n</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Lightbulb size={14} className="text-amber-400" />
                Alert LED (Pin D6):
              </span>
              <span className="text-amber-300 text-xs font-medium">Blinks 15s on new location</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">I2C LCD Address:</span>
              <span className="text-slate-300 font-mono text-xs">0x27 (A4: SDA, A5: SCL)</span>
            </div>
          </div>

          {/* Serial error alert */}
          {status?.lastError && !isConnected && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-red-400">
                <AlertCircle size={16} />
                Serial Communication Notice
              </div>
              <p className="font-mono break-all">{status.lastError}</p>
              <p className="text-slate-400 text-[11px] pt-1">
                Tip: Ensure the Arduino Serial Monitor in Arduino IDE is closed, as Windows COM ports cannot be shared simultaneously.
              </p>
            </div>
          )}
        </div>

        {/* Right: 16x2 LCD Live Simulator & Test Sender */}
        <div className="glass p-6 rounded-2xl space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity size={18} className="text-green-400" />
              16×2 I2C LCD Simulation
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 font-mono">
              Screen {lcdScreen + 1} of 3
            </span>
          </div>

          {/* Realistic 16x2 LCD Bezel */}
          <div
            className="rounded-2xl p-5 font-mono text-sm leading-7 shadow-inner select-none transition-all duration-300"
            style={{
              background: '#0d1d05',
              border: '4px solid #1f3b0e',
              boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.8), 0 0 20px rgba(74,222,128,0.1)',
            }}
          >
            <div className="text-green-400 text-base tracking-widest uppercase font-bold drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]">
              {lcdScreen === 0 && (
                <>
                  <div className="truncate">CITY: {lastCity}</div>
                  <div className="truncate">COUNTRY: {lastCountry}</div>
                </>
              )}
              {lcdScreen === 1 && (
                <>
                  <div className="truncate">TEMP: {lastTemp} C</div>
                  <div className="truncate">COND: WMO #{lastCode}</div>
                </>
              )}
              {lcdScreen === 2 && (
                <>
                  <div className="truncate">HUM: {lastHum}%</div>
                  <div className="truncate">WIND: {lastWind} KM/H</div>
                </>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 text-center">
            Arduino sketch rotates between Screen 1, 2, and 3 every 2.5 seconds via non-blocking <code className="text-blue-300">millis()</code>.
          </p>

          {/* Interactive Test Transmission */}
          <div className="pt-3 border-t border-white/5 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              Send Manual Serial Test Packet:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMsg}
                onChange={(e) => setTestMsg(e.target.value)}
                placeholder="CITY|COUNTRY|TEMP|WMO|HUM|WIND"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSendTest}
                disabled={testing || !isConnected}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
              >
                <Send size={13} className={testing ? 'animate-spin' : ''} />
                Send
              </button>
            </div>

            {testResult && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl text-xs font-mono ${
                  testResult.success
                    ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                    : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}
              >
                {testResult.message}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
