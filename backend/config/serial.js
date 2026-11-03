const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
require('dotenv').config();

// ── Internal State ─────────────────────────────────────────────────────────────
let port            = null;
let parser          = null;
let isOpening       = false;   // prevents concurrent port.open() calls
let isConnected     = false;   // port is physically open
let isReady         = false;   // Arduino finished bootloader reset & setup()
let readyTimer      = null;
let reconnectTimer  = null;
let lastError       = null;
let lastSentAt      = null;
let lastCity        = null;
let lastLocation    = null;   // Full location string (e.g. "NEW DELHI, INDIA")
let lastSentPayload = null;   // Last pipe-delimited message sent
let lastAck         = null;   // Last ACK/ERR response from Arduino: { status, at, message }

// Active promise handler waiting for Arduino ACK
let pendingAck      = null;

/**
 * Schedule auto-reconnect if port is disconnected.
 */
function scheduleReconnect(delayMs = 4000) {
  if (reconnectTimer || isOpening) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!port || !port.isOpen) {
      console.log('🔄 [Serial] Auto-reconnecting to Arduino…');
      initSerial();
    }
  }, delayMs);
}

/**
 * Initialize and open the serial connection to Arduino.
 * Guarded against multiple concurrent opens.
 */
function initSerial() {
  const comPort  = process.env.COM_PORT || 'COM3';
  const baudRate = parseInt(process.env.BAUD_RATE || '9600', 10);

  // If already open or opening, do not re-open
  if (port && port.isOpen) {
    console.log(`ℹ️  [Serial] Already connected on ${comPort}`);
    return;
  }
  if (isOpening) {
    console.log('ℹ️  [Serial] Connection attempt already in progress…');
    return;
  }

  isOpening = true;
  console.log(`🔌 [Serial] Attempting connection on ${comPort} at ${baudRate} baud…`);

  try {
    // Clean up existing instance if any
    if (port) {
      try {
        port.removeAllListeners();
      } catch (_) {}
      port = null;
    }

    port = new SerialPort({
      path: comPort,
      baudRate,
      autoOpen: false,
    });

    parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (raw) => {
      const msg = raw.trim();
      if (!msg) return;

      console.log(`📥 [Arduino -> Node.js] ${msg}`);

      // Arduino finished setup() and announced readiness
      if (msg === 'ARDUINO_READY') {
        isReady = true;
        if (readyTimer) {
          clearTimeout(readyTimer);
          readyTimer = null;
        }
        console.log('⚡ [Serial] Arduino bootloader reset complete. Ready for messages.');
        return;
      }

      // Handle ACK / Error replies for pending sends
      if (pendingAck) {
        if (msg === 'ACK') {
          lastAck = {
            status: 'ACK',
            message: 'ACK',
            at: new Date().toISOString(),
            success: true,
          };
          const resolve = pendingAck.resolve;
          pendingAck = null;
          resolve({ success: true, ack: 'ACK' });
        } else if (msg.startsWith('ERR')) {
          lastAck = {
            status: 'ERR',
            message: msg,
            at: new Date().toISOString(),
            success: false,
          };
          const reject = pendingAck.reject;
          pendingAck = null;
          reject(new Error(`Arduino rejected data: ${msg}`));
        }
      } else {
        lastAck = {
          status: msg.startsWith('ERR') ? 'ERR' : msg === 'ACK' ? 'ACK' : 'MSG',
          message: msg,
          at: new Date().toISOString(),
          success: !msg.startsWith('ERR'),
        };
      }
    });

    port.on('open', () => {
      isOpening   = false;
      isConnected = true;
      isReady     = false;
      lastError   = null;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      console.log(`✅ [Serial] Port ${comPort} opened successfully!`);

      // Arduino Uno auto-resets when DTR is toggled on port open.
      // Bootloader takes 1.5 - 2.5 seconds.
      // Wait for ARDUINO_READY or max 2500ms fallback before allowing sends.
      readyTimer = setTimeout(() => {
        isReady = true;
        readyTimer = null;
        console.log('⚡ [Serial] Arduino initialization timeout reached. Marked as ready.');
      }, 2500);
    });

    port.on('error', (err) => {
      isOpening   = false;
      isConnected = false;
      isReady     = false;
      lastError   = err.message;
      console.error(`❌ [Serial Error] ${err.message}`);

      if (pendingAck) {
        pendingAck.reject(err);
        pendingAck = null;
      }
      scheduleReconnect(4000);
    });

    port.on('close', () => {
      isOpening   = false;
      isConnected = false;
      isReady     = false;
      console.warn('⚠️  [Serial] Port closed.');

      if (pendingAck) {
        pendingAck.reject(new Error('Serial port closed while waiting for Arduino response'));
        pendingAck = null;
      }
      scheduleReconnect(4000);
    });

    port.open((err) => {
      isOpening = false;
      if (err) {
        isConnected = false;
        isReady     = false;
        lastError   = `Cannot open ${comPort}: ${err.message}`;
        console.error(`❌ [Serial] ${lastError}`);
        scheduleReconnect(4000);
      }
    });

  } catch (err) {
    isOpening   = false;
    isConnected = false;
    isReady     = false;
    lastError   = err.message;
    console.error(`❌ [Serial Init Exception] ${err.message}`);
    scheduleReconnect(4000);
  }
}

/**
 * Wait for Arduino bootloader reset to finish.
 */
function waitForReady(maxWaitMs = 3500) {
  if (isReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (isReady) {
        clearInterval(interval);
        resolve();
      } else if (!isConnected || !port || !port.isOpen) {
        clearInterval(interval);
        reject(new Error('Serial port not connected while waiting for Arduino initialization.'));
      } else if (Date.now() - start >= maxWaitMs) {
        clearInterval(interval);
        isReady = true;
        resolve();
      }
    }, 100);
  });
}

/**
 * Sends a pipe-delimited weather message to Arduino and waits for ACK.
 * Format: CITY|COUNTRY|TEMP_C|WMO_CODE|HUMIDITY|WIND_KMH\n
 *
 * @param {string} payload Message without trailing newline
 * @param {number} timeoutMs Max wait for Arduino ACK (default 4000ms)
 * @returns {Promise<{success: boolean, ack: string, duplicate?: boolean}>}
 */
async function sendToArduino(payload, timeoutMs = 4000) {
  const formattedPayload = (payload || '').trim();

  // Validate format (must have 5 pipes -> 6 fields)
  const pipeCount = (formattedPayload.match(/\|/g) || []).length;
  if (pipeCount !== 5) {
    throw new Error(`Invalid format. Expected 6 fields with 5 pipes (CITY|COUNTRY|TEMP|WMO|HUM|WIND). Got ${pipeCount + 1} fields.`);
  }

  // Deduplication check: do not resend identical message
  if (formattedPayload === lastSentPayload && lastAck && lastAck.success) {
    console.log(`ℹ️  [Serial] Duplicate weather message skipped: "${formattedPayload}"`);
    return {
      success: true,
      ack: lastAck.message || 'ACK',
      duplicate: true,
    };
  }

  // Confirm serial port is genuinely open
  if (!port || !port.isOpen || !isConnected) {
    const err = new Error(`Arduino not connected on ${process.env.COM_PORT || 'COM3'} (port is closed).`);
    console.warn(`⚠️  [Serial] ${err.message}`);
    throw err;
  }

  // Supercede any earlier pending ACK
  if (pendingAck) {
    clearTimeout(pendingAck.timer);
    pendingAck.reject(new Error('Superceded by newer serial transmission request'));
    pendingAck = null;
  }

  // Ensure Arduino finished booting
  await waitForReady();

  const line = `${formattedPayload}\n`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingAck && pendingAck.timer === timer) {
        console.warn(`⚠️  [Serial] Timeout: No ACK received from Arduino within ${timeoutMs}ms`);
        pendingAck = null;
        reject(new Error(`Timeout: Arduino did not send ACK within ${timeoutMs}ms`));
      }
    }, timeoutMs);

    pendingAck = {
      resolve: (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    };

    port.write(line, 'utf8', (err) => {
      if (err) {
        lastError = err.message;
        console.error(`❌ [Serial Write Error] ${err.message}`);
        clearTimeout(timer);
        pendingAck = null;
        return reject(err);
      }

      port.drain((drainErr) => {
        if (drainErr) {
          console.warn(`⚠️  [Serial Drain Warning] ${drainErr.message}`);
        }
        lastSentAt      = new Date().toISOString();
        lastSentPayload = formattedPayload;

        const parts     = formattedPayload.split('|');
        lastCity        = parts[0];
        lastLocation    = `${parts[0]}, ${parts[1]}`;
        console.log(`📤 [Node.js -> Arduino] Sent: ${formattedPayload}`);
      });
    });
  });
}

/**
 * Returns accurate live serial status.
 * Requirement 6: Do not show connected merely because port is configured.
 */
function getStatus() {
  const genuinelyConnected = Boolean(port && port.isOpen && isConnected);
  return {
    connected:    genuinelyConnected,
    ready:        genuinelyConnected && isReady,
    port:         process.env.COM_PORT || 'COM3',
    baudRate:     parseInt(process.env.BAUD_RATE || '9600', 10),
    lastError:    genuinelyConnected ? null : (lastError || 'Port closed'),
    lastSentAt,
    lastCity,
    lastLocation,
    lastSentPayload,
    lastAck,
  };
}

/**
 * Manually trigger a reconnect.
 */
async function reconnectSerial() {
  await closeSerial();
  initSerial();
  return getStatus();
}

/**
 * Cleanly close the serial port on application shutdown.
 */
function closeSerial() {
  return new Promise((resolve) => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }
    if (pendingAck) {
      clearTimeout(pendingAck.timer);
      pendingAck = null;
    }
    if (port && port.isOpen) {
      console.log('🔌 [Serial] Closing serial port cleanly…');
      port.close((err) => {
        if (err) console.error('❌ [Serial Close Error]', err.message);
        else console.log('✅ [Serial] Port closed cleanly.');
        isConnected = false;
        isReady     = false;
        resolve();
      });
    } else {
      isConnected = false;
      isReady     = false;
      resolve();
    }
  });
}

module.exports = {
  initSerial,
  sendToArduino,
  getStatus,
  reconnectSerial,
  closeSerial,
};
