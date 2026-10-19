import { defineConfig, type Plugin, type Connect } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const LOCAL_FORECAST = path.resolve(__dirname, 'dev-data/aaqe_forecast.geojson');
const NASA_ORIGIN = 'https://aeronet.gsfc.nasa.gov';
const AAQE_FORECAST_PREFIX = '/api/aeronet/data_push/AQI/output_AAQE_geoJSON/';
const NASA_PROBE_MS = 12_000;

type GeoJsonCollection = {
  type?: string;
  features?: Array<{ properties?: Record<string, unknown> } & Record<string, unknown>>;
};

let cachedForecast: GeoJsonCollection | null = null;

function loadLocalForecast(): GeoJsonCollection | null {
  if (cachedForecast) return cachedForecast;
  if (!fs.existsSync(LOCAL_FORECAST)) return null;
  cachedForecast = JSON.parse(fs.readFileSync(LOCAL_FORECAST, 'utf8')) as GeoJsonCollection;
  return cachedForecast;
}

function rewriteForecastDates(data: GeoJsonCollection, requestedYmd: string): GeoJsonCollection {
  const features = data.features ?? [];
  const originals = [
    ...new Set(features.map((f) => String(f.properties?.UTC_DATE ?? '')).filter(Boolean)),
  ].sort();
  const year = Number(requestedYmd.slice(0, 4));
  const month = Number(requestedYmd.slice(4, 6));
  const day = Number(requestedYmd.slice(6, 8));
  const start = Date.UTC(year, month - 1, day);
  const mapped = new Map<string, string>();
  originals.forEach((orig, i) => {
    mapped.set(orig, new Date(start + i * 86_400_000).toISOString().slice(0, 10));
  });
  return {
    ...data,
    features: features.map((f) => ({
      ...f,
      properties: {
        ...f.properties,
        UTC_DATE: mapped.get(String(f.properties?.UTC_DATE)) ?? f.properties?.UTC_DATE,
      },
    })),
  };
}

function requestedForecastYmd(url: string | undefined): string | null {
  const match = url?.match(/(\d{8})_forecast\.geojson(?:\?|$)/);
  return match?.[1] ?? null;
}

function writeLocalFallback(res: Connect.ServerResponse, ymd: string) {
  const data = loadLocalForecast();
  if (!data) return false;
  console.warn(`[vite] NASA AAQE forecast unavailable; serving dev fallback for ${ymd}_forecast.geojson`);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'X-AAQE-Forecast': 'local-fallback',
  });
  res.end(JSON.stringify(rewriteForecastDates(data, ymd)));
  return true;
}

function isWritableResponse(res: IncomingMessage | ServerResponse | undefined): res is ServerResponse {
  return Boolean(res && typeof (res as ServerResponse).writeHead === 'function');
}

/** Probe NASA with HEAD (fast). Live files are ~2MB+ — do not download in middleware (4s abort caused false fallbacks). */
async function nasaForecastReachable(nasaPath: string): Promise<'live' | 'missing' | 'down'> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), NASA_PROBE_MS);
    const up = await fetch(`${NASA_ORIGIN}${nasaPath}`, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(timer);
    if (up.ok) return 'live';
    if (up.status === 404 || up.status === 403) return 'missing';
    if (up.status >= 500) return 'down';
    return 'missing';
  } catch {
    return 'down';
  }
}

function localForecastFallback(): Plugin {
  return {
    name: 'aaqe-local-forecast-fallback',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(AAQE_FORECAST_PREFIX)) return next();
        const ymd = requestedForecastYmd(req.url);
        if (!ymd) return next();

        const nasaPath = req.url.replace(/^\/api\/aeronet/, '');
        const reach = await nasaForecastReachable(nasaPath);
        if (reach === 'live') return next(); // Vite proxy streams the real GeoJSON
        if (reach === 'missing') return next(); // real 404 for date probing
        if (writeLocalFallback(res, ymd)) return;
        return next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localForecastFallback()],
  server: {
    port: 5174,
    proxy: {
      '/api/aeronet': {
        target: NASA_ORIGIN,
        changeOrigin: true,
        rewrite: (urlPath) => urlPath.replace(/^\/api\/aeronet/, ''),
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            const url = req.url ?? '';
            if (
              isWritableResponse(res) &&
              !res.headersSent &&
              url.includes('output_AAQE_geoJSON') &&
              writeLocalFallback(res, requestedForecastYmd(url) ?? '00000000')
            ) {
              console.warn(`[vite] NASA proxy error (${err.message}); served dev fallback`);
              return;
            }
            if (isWritableResponse(res) && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'text/plain' });
              res.end(err.message);
            }
          });
        },
      },
    },
  },
});
