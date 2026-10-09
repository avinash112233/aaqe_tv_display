# AAQE TV Display

Standalone **office / TV signage** app for African AAQE PM₂.₅ forecast data.  
Static Vite + React app — no backend, no database, no API keys.

## What it shows

`/display?station=Uyo` (or any station name) is the full-screen TV view.

- **Header date + dial** follow the **latest available NASA daily file**. If today’s file is not published yet, the app uses yesterday’s (or the newest older) file and shows that file’s date and day-0 daily AQI.
- **Tomorrow / Day after** are the other two days in that same file.
- **7-day trend** is day-0 daily AQI from each past file (`YYYYMMDD_forecast.geojson`), not a forecast pulled from a later run. Missing NASA files are skipped.
- **Map** shows the Africa pollutant grid plus the selected station only.
- **Nearby cities** show AQI and PM₂.₅ from the same file, with the NASA GEOS-FP / SNWG / HAQAST source line.
- Auto-refresh every **30 minutes** (picks up today’s file when it appears).

Station picker at `/` is for setup. Bookmark one TV URL per office.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5174

Dev proxies NASA through Vite (`/api/aeronet` → `https://aeronet.gsfc.nasa.gov`) so the browser does not hit CORS limits.

## Production build (AWS)

```bash
npm ci
npm run build
```

Serve the `dist/` folder as a static site (S3 + CloudFront, Amplify, nginx, or similar).

**Required for AWS:** keep a same-origin proxy. The app fetches:

| App path | NASA path |
|---|---|
| `/api/aeronet/data_push/AQI/output_AAQE_geoJSON/YYYYMMDD_forecast.geojson` | `https://aeronet.gsfc.nasa.gov/data_push/AQI/output_AAQE_geoJSON/YYYYMMDD_forecast.geojson` |
| `/api/aeronet/aws_aq_forecast/Africa_Grid/YYYYMMDD_forecast.geojson` | `https://aeronet.gsfc.nasa.gov/aws_aq_forecast/Africa_Grid/YYYYMMDD_forecast.geojson` |

CloudFront (or nginx) should:

1. Serve `dist/` as the default origin.
2. Forward `/api/aeronet/*` to `https://aeronet.gsfc.nasa.gov/*` (strip the `/api/aeronet` prefix).
3. Treat the app as an SPA: unknown paths (`/display`) rewrite to `index.html`.

Do **not** set `VITE_AAQE_USE_DIRECT_NASA=true` unless NASA allows browser CORS. The proxy is the supported production path.

Optional build env:

```env
VITE_REFRESH_MINUTES=30
# Only if you already have your own forecast/grid proxy:
# VITE_AAQE_FORECAST_BASE_URL=https://your-proxy/data_push/AQI/output_AAQE_geoJSON/
# VITE_AAQE_GRID_BASE_URL=https://your-proxy/aws_aq_forecast/Africa_Grid/
```

## TV URL

```
https://<your-host>/display?station=Uyo
```

Open full-screen in the TV browser and bookmark it.

## Routes

| Path | Purpose |
|------|---------|
| `/` | Station picker (setup / testing) |
| `/display?station=Name` | Full-screen TV view |

## Data

Public NASA AERONET AAQE GeoJSON (same feeds the Africa dashboard uses). This app does not import dashboard code.
