# AAQE TV Display

TV signage for African AAQE PM₂.₅ forecasts.

```bash
npm install
npm run dev
```

Open http://localhost:5174 then `/display?station=Uyo` (or any station name).

```bash
npm run build
```

Serve `dist/` on AWS. Data is the public NASA AERONET AAQE GeoJSON.

In dev, if NASA is unreachable, Vite serves a cached snapshot from `dev-data/aaqe_forecast.geojson` (replace that file to refresh the fallback). Live data is used whenever `aeronet.gsfc.nasa.gov` responds.

### Deploy on Vercel (free, no laptop required)

1. In this folder, run `npx vercel login` and finish sign-in in the browser.
2. Run `npm run deploy` (or `npx vercel --prod`).
3. Open the printed `https://….vercel.app` URL — e.g. `/display?station=Lagos`.

`vercel.json` routes `/api/aeronet/*` to a **serverless proxy** (`api/nasa.js`) because Vercel edge rewrites to NASA often fail. Dev uses the Vite proxy in `vite.config.ts`.
