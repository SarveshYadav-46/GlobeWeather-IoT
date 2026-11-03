/*
 * ============================================================
 *  GlobeWeather – Arduino Uno Sketch v3.0
 *  Hardware : Arduino Uno + 16×2 I2C LCD (LiquidCrystal_I2C)
 *
 *  LCD Wiring:
 *    LCD GND  → Arduino GND
 *    LCD VCC  → Arduino 5V
 *    LCD SDA  → Arduino A4
 *    LCD SCL  → Arduino A5
 *
 *  I2C Address: 0x27 (Default for most PCF8574 modules)
 *
 *  Serial Protocol:
 *    Format  : CITY|COUNTRY|TEMP_C|WMO_CODE|HUMIDITY|WIND_KMH\n
 *    Example : NEW DELHI|INDIA|28|0|49|4\n
 *    Baud    : 9600
 *
 *  Screens (Rotates every 2.5 seconds via non-blocking millis()):
 *    Screen 1:
 *      Line 1: CITY: <city>
 *      Line 2: COUNTRY: <country>
 *      (Auto-scrolls if text exceeds 16 characters)
 *
 *    Screen 2:
 *      Line 1: TEMP: <temp> C
 *      Line 2: COND: <condition>
 *
 *    Screen 3:
 *      Line 1: HUM: <humidity>%
 *      Line 2: WIND: <wind> KM/H
 *
 *  Serial Responses:
 *    On boot       : ARDUINO_READY
 *    On valid data : ACK
 *    On error      : ERR:<reason>
 * ============================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ── LCD Setup ────────────────────────────────────────────────
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ── Timing Constants (non-blocking) ──────────────────────────
const unsigned long SCREEN_DELAY    = 2500;  // 2.5 seconds per screen
const unsigned long SCROLL_INTERVAL = 250;   // ms per scroll step for long text
const uint8_t       SERIAL_BUF_SZ   = 128;   // Safe buffer size for incoming serial

// ── LED Alert on Pin D6 (Blinks for 15s on new location) ────
const uint8_t       LED_PIN         = 6;     // LED connected to Digital Pin 6
const unsigned long LED_BLINK_TOTAL = 15000; // Blink duration: 15 seconds
const unsigned long LED_TOGGLE_MS   = 250;   // Toggle every 250ms

// ── Data Storage ─────────────────────────────────────────────
char gCity[33]      = "";
char gCountry[33]   = "";
int  gTemp          = 0;
int  gWmoCode       = 0;
int  gHumidity      = 0;
int  gWind          = 0;
char gCondition[17] = "";

// ── State Variables ──────────────────────────────────────────
bool          dataReady        = false;
uint8_t       currentScreen    = 0;
unsigned long lastScreenSwitch = 0;
unsigned long lastScrollUpdate = 0;

// ── LED State ────────────────────────────────────────────────
bool          ledBlinking      = false;
unsigned long ledStartTime     = 0;
unsigned long lastLedToggle    = 0;
uint8_t       ledState         = LOW;

// ── Serial Buffer ────────────────────────────────────────────
char    serialBuf[SERIAL_BUF_SZ];
uint8_t serialIdx = 0;

// ── WMO Weather Code Mapper ──────────────────────────────────
// Returns concise condition strings (<= 10 chars so "COND: " + text <= 16 chars)
const char* wmoToDesc(int code) {
  switch (code) {
    case 0:  return "CLEAR";
    case 1:  return "MAINLY CLR";
    case 2:  return "PARTLY CLD";
    case 3:  return "OVERCAST";
    case 45:
    case 48: return "FOGGY";
    case 51:
    case 53: return "DRIZZLE";
    case 55: return "HVY DRIZ";
    case 61:
    case 63: return "RAIN";
    case 65: return "HVY RAIN";
    case 71:
    case 73: return "SNOW";
    case 75: return "HVY SNOW";
    case 77: return "SNOW GRAIN";
    case 80:
    case 81: return "SHOWERS";
    case 82: return "HVY SHWRS";
    case 85:
    case 86: return "SNOW SHWRS";
    case 95: return "THUNDER";
    case 96:
    case 99: return "HAIL STORM";
    default: return "UNKNOWN";
  }
}

// ── LCD Output Helper: Writes exactly 16 characters ──────────
void printLine(uint8_t row, const char* text) {
  char buf[17];
  snprintf(buf, sizeof(buf), "%-16s", text);  // Left-align and pad with spaces to 16 chars
  lcd.setCursor(0, row);
  lcd.print(buf);
}

// ── Non-blocking Scrolling Line Helper ────────────────────────
// If prefix + value <= 16 chars: prints static text padded with spaces
// If prefix + value > 16 chars : holds for 500ms, then scrolls smoothly
void renderScrollableLine(uint8_t row, const char* prefix, const char* value, unsigned long elapsed) {
  char fullText[64];
  snprintf(fullText, sizeof(fullText), "%s%s", prefix, value);
  int len = strlen(fullText);

  if (len <= 16) {
    printLine(row, fullText);
    return;
  }

  // Calculate scrolling offset
  int maxOffset = len - 16;
  int offset = 0;
  if (elapsed > 500) {
    offset = (elapsed - 500) / SCROLL_INTERVAL;
    if (offset > maxOffset) {
      offset = maxOffset;  // Hold at end
    }
  }

  char window[17];
  strncpy(window, fullText + offset, 16);
  window[16] = '\0';
  printLine(row, window);
}

// ── Screen Rendering Functions ───────────────────────────────
void renderScreen0(unsigned long elapsed) {
  renderScrollableLine(0, "CITY: ", gCity, elapsed);
  renderScrollableLine(1, "COUNTRY: ", gCountry, elapsed);
}

void renderScreen1() {
  char line1[17];
  char line2[17];
  snprintf(line1, sizeof(line1), "TEMP: %d C", gTemp);
  snprintf(line2, sizeof(line2), "COND: %s", gCondition);
  printLine(0, line1);
  printLine(1, line2);
}

void renderScreen2() {
  char line1[17];
  char line2[17];
  snprintf(line1, sizeof(line1), "HUM: %d%%", gHumidity);
  snprintf(line2, sizeof(line2), "WIND: %d KM/H", gWind);
  printLine(0, line1);
  printLine(1, line2);
}

// ── Parse Pipe-delimited Message ─────────────────────────────
// Format: CITY|COUNTRY|TEMP_C|WMO_CODE|HUMIDITY|WIND_KMH
void parseMessage(char* msg) {
  char buf[SERIAL_BUF_SZ];
  strncpy(buf, msg, sizeof(buf) - 1);
  buf[sizeof(buf) - 1] = '\0';

  char* token;

  // 1. CITY
  token = strtok(buf, "|");
  if (!token || strlen(token) == 0) {
    Serial.println("ERR:FIELD_CITY");
    return;
  }
  strncpy(gCity, token, sizeof(gCity) - 1);
  gCity[sizeof(gCity) - 1] = '\0';

  // 2. COUNTRY
  token = strtok(NULL, "|");
  if (!token || strlen(token) == 0) {
    Serial.println("ERR:FIELD_COUNTRY");
    return;
  }
  strncpy(gCountry, token, sizeof(gCountry) - 1);
  gCountry[sizeof(gCountry) - 1] = '\0';

  // 3. TEMP
  token = strtok(NULL, "|");
  if (!token) {
    Serial.println("ERR:FIELD_TEMP");
    return;
  }
  gTemp = atoi(token);

  // 4. WMO CODE
  token = strtok(NULL, "|");
  if (!token) {
    Serial.println("ERR:FIELD_WMO");
    return;
  }
  gWmoCode = atoi(token);

  // 5. HUMIDITY
  token = strtok(NULL, "|");
  if (!token) {
    Serial.println("ERR:FIELD_HUM");
    return;
  }
  gHumidity = atoi(token);

  // 6. WIND
  token = strtok(NULL, "|\r\n");
  if (!token) {
    Serial.println("ERR:FIELD_WIND");
    return;
  }
  gWind = atoi(token);

  // Format condition string
  strncpy(gCondition, wmoToDesc(gWmoCode), sizeof(gCondition) - 1);
  gCondition[sizeof(gCondition) - 1] = '\0';

  // Update state and immediately display Screen 1 (City / Country)
  dataReady        = true;
  currentScreen    = 0;
  lastScreenSwitch = millis();
  lastScrollUpdate = 0;

  lcd.clear();
  renderScreen0(0);

  // Trigger 7-second LED blink on pin D6 (only when new location is selected)
  ledBlinking   = true;
  ledStartTime  = millis();
  lastLedToggle = millis();
  ledState      = HIGH;
  digitalWrite(LED_PIN, HIGH);

  // Send ACK to Node.js backend
  Serial.println("ACK");
}

// ── Read Serial Stream ───────────────────────────────────────
void readSerial() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();

    if (c == '\n' || c == '\r') {
      if (serialIdx > 0) {
        serialBuf[serialIdx] = '\0';
        parseMessage(serialBuf);
        serialIdx = 0;
      }
    } else {
      if (serialIdx < SERIAL_BUF_SZ - 1) {
        serialBuf[serialIdx++] = c;
      } else {
        // Overflow safety: reset buffer and report error
        serialIdx = 0;
        Serial.println("ERR:OVERFLOW");
      }
    }
  }
}

// ── Initial Startup Display ──────────────────────────────────
void showStartup() {
  lcd.clear();
  printLine(0, " GLOBEWEATHER   ");
  printLine(1, " WAITING DATA...");
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(9600);
  Wire.begin();

  // Initialize LED on pin D6 (OFF initially)
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  lcd.init();
  lcd.backlight();
  showStartup();

  // Announce readiness to Node.js backend
  Serial.println("ARDUINO_READY");
}

// ============================================================
//  MAIN LOOP
// ============================================================
void loop() {
  readSerial();

  // ── Non-blocking 7-second LED blink on pin D6 ─────────────
  if (ledBlinking) {
    unsigned long now = millis();
    if (now - ledStartTime >= LED_BLINK_TOTAL) {
      ledBlinking = false;
      ledState    = LOW;
      digitalWrite(LED_PIN, LOW);
    } else if (now - lastLedToggle >= LED_TOGGLE_MS) {
      lastLedToggle = now;
      ledState      = (ledState == HIGH) ? LOW : HIGH;
      digitalWrite(LED_PIN, ledState);
    }
  }

  if (dataReady) {
    unsigned long now = millis();

    // Check if it's time to rotate screen (every 2.5 seconds)
    if (now - lastScreenSwitch >= SCREEN_DELAY) {
      currentScreen    = (currentScreen + 1) % 3;
      lastScreenSwitch = now;
      lastScrollUpdate = 0; // Trigger immediate render on switch

      lcd.clear();
      if (currentScreen == 1) {
        renderScreen1();
      } else if (currentScreen == 2) {
        renderScreen2();
      }
    }

    // Screen 0 (City/Country) requires periodic updates for smooth scrolling
    if (currentScreen == 0) {
      if (now - lastScrollUpdate >= SCROLL_INTERVAL) {
        lastScrollUpdate = now;
        renderScreen0(now - lastScreenSwitch);
      }
    }
  }
}
