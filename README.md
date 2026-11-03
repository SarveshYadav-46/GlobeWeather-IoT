# 🌍 GlobeWeather – Interactive Globe Weather Information System

A full-stack IoT project featuring a **3D interactive Earth globe** with real-time weather data and **Arduino Uno + 16×2 I2C LCD** display integration.

---

## 📸 Features

- 🌏 Realistic, rotating 3D Earth globe (NASA textures)
- 🖱️ Click anywhere on the globe to get live weather
- 🔍 City search with autocomplete suggestions
- 🌤️ Real-time weather via **Open-Meteo API** (no API key needed)
- 📟 Sends weather to **Arduino Uno** via USB serial
- 💡 16×2 I2C LCD rotates through 3 info screens every 2.5s
- 💎 Premium dark-mode glassmorphism UI with animations

---

## 🗂️ Folder Structure

```
GlobeWeather/
├── frontend/           ← React + Vite + Tailwind
│   └── src/
│       ├── components/ ← Globe, SearchBar, WeatherCard, DeviceStatus, Navbar
│       ├── pages/      ← Home.jsx
│       └── services/   ← weatherService.js
├── backend/            ← Node.js + Express
│   ├── config/         ← serial.js  (Arduino SerialPort)
│   ├── controllers/    ← weatherController.js
│   ├── routes/         ← weatherRoutes.js
│   └── services/       ← weatherService.js, arduinoService.js
└── arduino/
    └── GlobeWeather.ino
```

---

## 🔌 Arduino Wiring

| LCD Pin | Arduino Uno |
|---------|-------------|
| GND     | GND         |
| VCC     | 5V          |
| SDA     | A4          |
| SCL     | A5          |

---

## 🚀 Setup Instructions

### Step 1 – Find Your Arduino COM Port

1. Connect your Arduino Uno via USB.
2. Open **Device Manager** → expand **Ports (COM & LPT)**.
3. Note the port (e.g., `COM3`, `COM5`).

### Step 2 – Upload Arduino Sketch

1. Open **Arduino IDE**.
2. Install the **LiquidCrystal_I2C** library:
   - Tools → Manage Libraries → search "LiquidCrystal I2C" → install by Frank de Brabander
3. Open `arduino/GlobeWeather.ino`.
4. Set the correct board: Tools → Board → **Arduino Uno**.
5. Select your COM port: Tools → Port → **COMX**.
6. Click **Upload** (→).
7. **Close Arduino IDE Serial Monitor** before starting the Node.js backend.

> **I2C Address Note:** The sketch uses `0x27`. If the LCD doesn't light up, change to `0x3F` in line 40 of the sketch.

### Step 3 – Configure Backend

1. Open `backend/.env`.
2. Set your COM port:
   ```
   COM_PORT=COM3    ← change this to your actual port
   BAUD_RATE=9600
   PORT=3001
   FRONTEND_URL=http://localhost:5173
   ```

### Step 4 – Start the Backend

```powershell
cd GlobeWeather/backend
npm install       # (already done if following this guide)
node server.js
```

You should see:
```
🌍 GlobeWeather Backend running on http://localhost:3001
✅ Arduino connected on COM3
```

### Step 5 – Start the Frontend

Open a **second terminal**:

```powershell
cd GlobeWeather/frontend
npm install       # (already done)
npm run dev
```

Open your browser at: **http://localhost:5173**

---

## 📟 LCD Display Format

The LCD cycles through 3 screens every 2.5 seconds:

```
Screen 1:          Screen 2:          Screen 3:
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│CITY:LONDON     │  │TEMP: 18 C      │  │HUM: 72%        │
│UNITED KINGDOM  │  │OVERCAST        │  │WIND:14KM/H     │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## 🌐 API Endpoints

| Method | Endpoint                              | Description                     |
|--------|---------------------------------------|---------------------------------|
| GET    | `/api/weather/search?q=London`        | City autocomplete               |
| GET    | `/api/weather/current?lat=...&lng=...`| Live weather for coordinates    |
| POST   | `/api/location/select`                | Select city → weather + Arduino |
| GET    | `/api/arduino/status`                 | Arduino connection status       |
| GET    | `/api/weather/selected`               | Last selected city weather      |

---

## 🔧 Serial Message Format

Node.js → Arduino (newline-terminated, pipe-delimited):

```
LONDON|UNITED KINGDOM|18|3|72|14\n
```

| Field   | Description              |
|---------|--------------------------|
| CITY    | City name (max 14 chars) |
| COUNTRY | Country (max 14 chars)   |
| TEMP    | Temperature in °C        |
| WMO     | WMO weather code         |
| HUM     | Humidity %               |
| WIND    | Wind speed km/h          |

---

## 🌤️ APIs Used (No API Key Required)

| API | Purpose | URL |
|-----|---------|-----|
| Open-Meteo Weather | Live weather | api.open-meteo.com |
| Open-Meteo Geocoding | City search | geocoding-api.open-meteo.com |
| BigDataCloud | Reverse geocoding | api.bigdatacloud.net |

---

## 🔬 Troubleshooting

| Problem | Solution |
|---------|----------|
| LCD doesn't show anything | Try I2C address `0x3F` instead of `0x27` |
| "Cannot open COM3" error | Check COM port in Device Manager, update `.env` |
| Arduino IDE blocking port | Close Serial Monitor before starting backend |
| Globe not loading | Check internet connection (textures loaded from CDN) |
| Weather not updating | Ensure backend is running on port 3001 |

---

## 📦 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS v4, globe.gl, Framer Motion, Lucide React
- **Backend**: Node.js, Express, Axios, SerialPort
- **Hardware**: Arduino Uno, 16×2 I2C LCD, LiquidCrystal_I2C library
- **APIs**: Open-Meteo (weather + geocoding), BigDataCloud (reverse geocoding)
