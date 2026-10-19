import dayjs from 'dayjs';
import { getAqiCategory } from '../utils/aqi';
import { fetchAeronetUrl } from './aeronetFetch';

/**
 * Sujan/Jun's Africa-wide pollutant grid feed (same host/pattern as the main AAQE
 * station feed, different path). It's a dense regular lat/lon grid (~98k cells,
 * ~0.25°x0.31° spacing) covering the whole continent — a 60MB+ GeoJSON file per
 * day. We fetch it once (lazily, only when the viewer opens "Pollutant View"),
 * then rasterize it client-side into a small PNG and display it as a single
 * Leaflet image overlay — much cheaper than rendering ~98k markers/heat points.
 */
const PROXY_BASE = '/api/aeronet/aws_aq_forecast/Africa_Grid/';
const DIRECT_BASE = 'https://aeronet.gsfc.nasa.gov/aws_aq_forecast/Africa_Grid/';

function getGridBaseUrl(): string {
  const raw = import.meta.env.VITE_AAQE_GRID_BASE_URL?.trim();
  if (raw) return raw.endsWith('/') ? raw : `${raw}/`;
  if (import.meta.env.VITE_AAQE_USE_DIRECT_NASA === 'true') return DIRECT_BASE;
  return PROXY_BASE;
}

function toYmdCompact(date: string): string {
  return date.replaceAll('-', '');
}

function gridUrlForDate(dateIso: string): string {
  return `${getGridBaseUrl()}${toYmdCompact(dateIso)}_forecast.geojson`;
}

// Cheap existence check (HEAD, no body) — the file is 60MB+, never GET it just to probe.
async function probeGridInitDate(dateIso: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetchAeronetUrl(gridUrlForDate(dateIso), {
      method: 'HEAD',
      signal: ctrl.signal,
    });
    return res.ok ? dateIso : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function findNearestGridInitDate(startIso: string): Promise<string | null> {
  let d = dayjs(startIso, 'YYYY-MM-DD', true);
  if (!d.isValid()) return null;
  // Shorter retention than the station feed (observed ~a few weeks), so a short lookback is enough.
  for (let i = 0; i < 6; i++) {
    const iso = d.format('YYYY-MM-DD');
    const found = await probeGridInitDate(iso);
    if (found) return found;
    d = d.subtract(1, 'day');
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

/** Finds the regular grid's axis (min/max/step/cell-count) from the actual sampled
 * coordinates, rather than hardcoding NASA's current spacing — stays correct even
 * if they ever change the grid resolution. */
function computeAxis(values: Float64Array): { min: number; max: number; step: number; size: number } {
  const unique = Array.from(new Set(Array.from(values, (v) => Math.round(v * 1e6) / 1e6))).sort((a, b) => a - b);
  const min = unique[0];
  const max = unique[unique.length - 1];
  let step = Infinity;
  for (let i = 1; i < unique.length; i++) {
    const d = unique[i] - unique[i - 1];
    if (d > 1e-6 && d < step) step = d;
  }
  if (!Number.isFinite(step) || step <= 0) step = max - min || 1;
  const size = Math.max(1, Math.round((max - min) / step) + 1);
  return { min, max, step, size };
}

export interface PollutantGridOverlay {
  /** data: URL PNG, one pixel per grid cell — pass straight to Leaflet's imageOverlay. */
  dataUrl: string;
  bounds: [[number, number], [number, number]];
  initDate: string;
  cellCount: number;
}

/** Fetches the day's Africa grid feed, then rasterizes DAILY_AQI straight into a
 * small canvas-based PNG (one pixel per grid cell, AQI category color, transparent
 * where there's no data e.g. ocean) sized to the map's exact geographic bounds. */
export async function loadPollutantGridOverlay(startIso?: string): Promise<PollutantGridOverlay> {
  const today = startIso ?? dayjs().format('YYYY-MM-DD');
  const initDate = await findNearestGridInitDate(today);
  if (!initDate) throw new Error('No recent pollutant grid file found.');

  const res = await fetchAeronetUrl(gridUrlForDate(initDate));
  if (!res.ok) throw new Error(`Pollutant grid unavailable for ${initDate} (${res.status})`);

  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { DAILY_AQI?: number };
    }>;
  };
  const features = data.features ?? [];
  const n = features.length;
  if (n === 0) throw new Error(`Pollutant grid for ${initDate} had no cells.`);

  const lons = new Float64Array(n);
  const lats = new Float64Array(n);
  const aqis = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const f = features[i];
    lons[i] = f.geometry?.coordinates?.[0] ?? NaN;
    lats[i] = f.geometry?.coordinates?.[1] ?? NaN;
    const a = f.properties?.DAILY_AQI;
    aqis[i] = typeof a === 'number' && Number.isFinite(a) ? a : NaN;
  }

  const lonAxis = computeAxis(lons);
  const latAxis = computeAxis(lats);
  const width = lonAxis.size;
  const height = latAxis.size;
  const pixels = new Uint8ClampedArray(width * height * 4); // starts fully transparent

  for (let i = 0; i < n; i++) {
    const lon = lons[i];
    const lat = lats[i];
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(aqis[i])) continue;
    const col = Math.round((lon - lonAxis.min) / lonAxis.step);
    const row = Math.round((latAxis.max - lat) / latAxis.step); // image row 0 = north
    if (col < 0 || col >= width || row < 0 || row >= height) continue;
    const [r, g, b] = hexToRgb(getAqiCategory(aqis[i]).color);
    const idx = (row * width + col) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = 255;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    bounds: [
      [latAxis.min - latAxis.step / 2, lonAxis.min - lonAxis.step / 2],
      [latAxis.max + latAxis.step / 2, lonAxis.max + lonAxis.step / 2],
    ],
    initDate,
    cellCount: n,
  };
}
