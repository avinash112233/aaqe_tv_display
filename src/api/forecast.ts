import dayjs from 'dayjs';
import { fetchAeronetUrl } from './aeronetFetch';

const PROXY_BASE = '/api/aeronet/data_push/AQI/output_AAQE_geoJSON/';
const DIRECT_BASE = 'https://aeronet.gsfc.nasa.gov/data_push/AQI/output_AAQE_geoJSON/';

export function getForecastBaseUrl(): string {
  const raw = import.meta.env.VITE_AAQE_FORECAST_BASE_URL?.trim();
  if (raw) return raw.endsWith('/') ? raw : `${raw}/`;
  if (import.meta.env.VITE_AAQE_USE_DIRECT_NASA === 'true') return DIRECT_BASE;
  return PROXY_BASE;
}

const forecastFileCache = new Map<string, ForecastPoint[]>();
const forecastInflight = new Map<string, Promise<ForecastPoint[]>>();
const missingForecastDates = new Set<string>();

export interface ForecastProperties {
  Station?: string;
  Site_Name?: string;
  UTC_DATE?: string;
  DAILY_AQI?: number;
  PM_DAILY?: number;
  [key: string]: string | number | undefined;
}

export interface ForecastPoint {
  latitude: number;
  longitude: number;
  properties: ForecastProperties;
}

interface GeoJsonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: ForecastProperties;
}

interface GeoJsonCollection {
  features?: GeoJsonFeature[];
}

function toNumber(value: string | number | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeUtcDate(value: string | number | undefined): string | null {
  if (value == null || value === '') return null;
  const v = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  const d = dayjs(v.slice(0, 10), 'YYYY-MM-DD', true);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

function toYmdCompact(date: string): string {
  return date.replaceAll('-', '');
}

type ProbeInitResult = { kind: 'hit'; date: string } | { kind: 'missing' } | { kind: 'unreachable' };

async function probeInitDate(dateIso: string): Promise<ProbeInitResult> {
  const url = `${getForecastBaseUrl()}${toYmdCompact(dateIso)}_forecast.geojson`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetchAeronetUrl(url, { signal: ctrl.signal });
    res.body?.cancel().catch(() => {});
    if (res.ok) return { kind: 'hit', date: dateIso };
    if (res.status >= 500) return { kind: 'unreachable' };
    return { kind: 'missing' };
  } catch {
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

export async function findNearestInitDate(startIso: string): Promise<string | null> {
  let d = dayjs(startIso, 'YYYY-MM-DD', true);
  if (!d.isValid()) return null;

  let sawUnreachable = false;
  for (let i = 0; i < 8; i++) {
    const iso = d.format('YYYY-MM-DD');
    const probe = await probeInitDate(iso);
    if (probe.kind === 'hit') return probe.date;
    if (probe.kind === 'unreachable') sawUnreachable = true;
    d = d.subtract(1, 'day');
  }
  if (sawUnreachable) {
    throw new Error(
      'Cannot reach the NASA AERONET forecast server (connection failed). ' +
        'Open https://aeronet.gsfc.nasa.gov in your browser or try GSFC VPN, then reload.'
    );
  }
  return null;
}

export async function fetchForecastByInitDate(initIso: string): Promise<ForecastPoint[]> {
  if (missingForecastDates.has(initIso)) {
    throw new Error(`Forecast unavailable for ${initIso}`);
  }
  const hit = forecastFileCache.get(initIso);
  if (hit) return hit;
  const pending = forecastInflight.get(initIso);
  if (pending) return pending;

  const request = (async () => {
    const url = `${getForecastBaseUrl()}${toYmdCompact(initIso)}_forecast.geojson`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetchAeronetUrl(url, { signal: ctrl.signal });
      if (!res.ok) {
        missingForecastDates.add(initIso);
        throw new Error(`Forecast unavailable for ${initIso} (${res.status})`);
      }

      const data = (await res.json()) as GeoJsonCollection;
      const points: ForecastPoint[] = [];
      for (const feature of data.features ?? []) {
        const lon = feature.geometry?.coordinates?.[0];
        const lat = feature.geometry?.coordinates?.[1];
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        points.push({
          latitude: lat as number,
          longitude: lon as number,
          properties: feature.properties ?? {},
        });
      }
      forecastFileCache.set(initIso, points);
      return points;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => {
    forecastInflight.delete(initIso);
  });

  forecastInflight.set(initIso, request);
  return request;
}

export interface StationDayForecast {
  date: string;
  label: string;
  aqi: number | null;
  pm25: number | null;
}

export interface NearbyCityAqi {
  name: string;
  aqi: number | null;
  pm25: number | null;
}

export interface MapStationPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  aqi: number | null;
  pm25: number | null;
}

export interface StationDisplayData {
  initDate: string;
  stationId: string;
  stationName: string;
  latitude: number;
  longitude: number;
  days: StationDayForecast[];
  /** Nearest other stations from the same feed, for the "other cities" comparison panel. */
  nearbyCities: NearbyCityAqi[];
  /** The dial station only — the map shows this one point. */
  mapStations: MapStationPoint[];
  fetchedAt: string;
}

/** Stable numeric Station id for grouping forecast days. */
function canonicalStationId(properties: ForecastProperties): string {
  const station = String(properties.Station ?? '').trim();
  if (station) return station;
  return String(properties.Site_Name ?? '').trim().toLowerCase();
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replaceAll('_', ' ').replace(/\s+/g, ' ');
}

function siteNameSearchKey(properties: ForecastProperties): string {
  return normalizeSearchText(String(properties.Site_Name ?? ''));
}

function displayName(properties: ForecastProperties): string {
  const site = String(properties.Site_Name ?? '').trim();
  if (site) return site.replaceAll('_', ' ');
  return String(properties.Station ?? 'Unknown station').trim();
}

function pickStation(
  points: ForecastPoint[],
  query: { station?: string; lat?: number; lon?: number }
): ForecastPoint | null {
  if (points.length === 0) return null;

  if (query.station) {
    const q = normalizeSearchText(query.station);
    const byId = new Map<string, ForecastPoint>();
    for (const p of points) {
      const id = canonicalStationId(p.properties);
      if (!byId.has(id)) byId.set(id, p);
    }
    const unique = [...byId.values()];

    const exactSite = unique.find((p) => siteNameSearchKey(p.properties) === q);
    if (exactSite) return exactSite;

    const exactId = unique.find((p) => canonicalStationId(p.properties) === q.replace(/\s+/g, ''));
    if (exactId) return exactId;

    const partialSite = unique.find((p) => siteNameSearchKey(p.properties).includes(q));
    if (partialSite) return partialSite;
  }

  if (query.lat != null && query.lon != null && Number.isFinite(query.lat) && Number.isFinite(query.lon)) {
    let best: ForecastPoint | null = null;
    let bestDist = Infinity;
    for (const p of points) {
      const dLat = p.latitude - query.lat;
      const dLon = p.longitude - query.lon;
      const dist = dLat * dLat + dLon * dLon;
      if (dist < bestDist) {
        bestDist = dist;
        best = p;
      }
    }
    return best;
  }

  return null;
}

const PM_SLOT_KEY = /^3HR_PM_CONC_CNN\(\d+\)$/;

function dailyPm25(properties: ForecastProperties): number | null {
  const explicit = toNumber(properties.PM_DAILY);
  if (explicit != null) return explicit;

  const slots: number[] = [];
  for (const [key, value] of Object.entries(properties)) {
    if (!PM_SLOT_KEY.test(key)) continue;
    const n = toNumber(value);
    if (n != null) slots.push(n);
  }
  if (slots.length === 0) return null;
  return slots.reduce((sum, n) => sum + n, 0) / slots.length;
}

function dayForecastForStation(
  points: ForecastPoint[],
  stationId: string,
  targetIso: string
): StationDayForecast | null {
  const matches = points.filter((p) => {
    if (canonicalStationId(p.properties) !== stationId) return false;
    return normalizeUtcDate(p.properties.UTC_DATE) === targetIso;
  });
  if (matches.length === 0) return null;

  const props = matches[0].properties;
  return {
    date: targetIso,
    label: dayjs(targetIso).format('ddd · MMM D'),
    aqi: toNumber(props.DAILY_AQI),
    pm25: dailyPm25(props),
  };
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km — used to tell "same metro area" apart from "a different city". */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Many AAQE networks run several monitors inside the same metro area (e.g.
 * Lagos also has Apapa/Mushin/Somolu/Ikeja/Agege, all within ~20km). A plain
 * "nearest N" pick would surface those as "other stations" even though
 * they're really the same city. This greedily picks stations that are each
 * at least `minSeparationKm` away from every previously picked one (and from
 * the anchor), so the result reads as genuinely different nearby cities.
 */
const OTHER_CITIES_MIN_SEPARATION_KM = 40;

function pickSpreadOutCities(
  sortedByDistance: MapStationPoint[],
  anchor: { latitude: number; longitude: number },
  anchorId: string,
  limit: number
): NearbyCityAqi[] {
  const pickedCoords: { latitude: number; longitude: number }[] = [
    { latitude: anchor.latitude, longitude: anchor.longitude },
  ];
  const picked: MapStationPoint[] = [];

  for (const s of sortedByDistance) {
    if (s.id === anchorId) continue;
    const farEnough = pickedCoords.every(
      (p) => haversineKm(p.latitude, p.longitude, s.latitude, s.longitude) >= OTHER_CITIES_MIN_SEPARATION_KM
    );
    if (!farEnough) continue;
    picked.push(s);
    pickedCoords.push(s);
    if (picked.length >= limit) break;
  }

  return picked.map(({ name, aqi, pm25 }) => ({ name, aqi, pm25 }));
}

/**
 * All unique stations from the feed, with AQI for `targetIso`, sorted nearest-first
 * to `anchor` (anchor itself included at distance 0). Backs both the "other
 * stations" comparison table and the map panel's point markers.
 */
function stationSummaries(points: ForecastPoint[], anchor: ForecastPoint, targetIso: string): MapStationPoint[] {
  const byId = new Map<string, ForecastPoint>();
  for (const p of points) {
    const id = canonicalStationId(p.properties);
    if (id && !byId.has(id)) byId.set(id, p);
  }

  const list: MapStationPoint[] = [...byId.values()].map((p) => {
    const id = canonicalStationId(p.properties);
    const day = dayForecastForStation(points, id, targetIso);
    return {
      id,
      name: displayName(p.properties),
      latitude: p.latitude,
      longitude: p.longitude,
      aqi: day?.aqi ?? null,
      pm25: day?.pm25 ?? null,
    };
  });

  list.sort((a, b) => {
    const da = (a.latitude - anchor.latitude) ** 2 + (a.longitude - anchor.longitude) ** 2;
    const db = (b.latitude - anchor.latitude) ** 2 + (b.longitude - anchor.longitude) ** 2;
    return da - db;
  });

  return list;
}

export async function loadStationDisplay(query: {
  station?: string;
  lat?: number;
  lon?: number;
}): Promise<StationDisplayData> {
  const calendarToday = dayjs().format('YYYY-MM-DD');
  // Newest available file: today if published, otherwise yesterday (or earlier).
  // Header, dial, and forecast chips all follow that file's dates.
  const initDate = await findNearestInitDate(calendarToday);
  if (!initDate) throw new Error('No recent AAQE forecast file found.');

  const points = await fetchForecastByInitDate(initDate);
  const anchor = pickStation(points, query);
  if (!anchor) {
    throw new Error(
      query.station
        ? `Station "${query.station}" not found in forecast.`
        : 'Provide ?station=ID or ?lat=&lon= in the URL.'
    );
  }

  const stationId = canonicalStationId(anchor.properties);
  const days: StationDayForecast[] = [];
  for (let offset = 0; offset <= 2; offset += 1) {
    const iso = dayjs(initDate).add(offset, 'day').format('YYYY-MM-DD');
    const day = dayForecastForStation(points, stationId, iso);
    if (day) days.push(day);
  }

  if (days.length === 0) {
    throw new Error('No forecast days available for this station.');
  }

  const summaries = stationSummaries(points, anchor, initDate);
  // "Other Stations" table: genuinely different nearby cities/towns, not
  // same-metro neighborhoods (e.g. Lagos also monitors Apapa/Mushin/Somolu/
  // Ikeja/Agege — all <20km away — so a plain nearest-N pick would just list
  // Lagos five times over instead of actually different places).
  const nearbyCities = pickSpreadOutCities(summaries, anchor, stationId, 5);
  const mapStations = summaries.filter((s) => s.id === stationId);

  return {
    initDate,
    stationId,
    stationName: displayName(anchor.properties),
    latitude: anchor.latitude,
    longitude: anchor.longitude,
    days,
    nearbyCities,
    mapStations,
    fetchedAt: new Date().toISOString(),
  };
}

export interface StationHistoryPoint {
  date: string;
  aqi: number | null;
  pm25: number | null;
}

async function historyRowForDate(stationId: string, iso: string): Promise<StationHistoryPoint | null> {
  try {
    const points = await fetchForecastByInitDate(iso);
    const day = dayForecastForStation(points, stationId, iso);
    if (day?.aqi == null) return null;
    return { date: iso, aqi: day.aqi, pm25: day.pm25 };
  } catch {
    missingForecastDates.add(iso);
    return null;
  }
}

/** Day-0 daily AQI for one station across the most recent available model runs. */
export async function loadStationHistory(
  stationId: string,
  count = 7,
  fromIso?: string
): Promise<StationHistoryPoint[]> {
  const start = fromIso ?? dayjs().format('YYYY-MM-DD');
  const maxLookback = 21;
  const rows: StationHistoryPoint[] = [];

  for (let offset = 0; offset < maxLookback && rows.length < count; ) {
    const batchSize = Math.min(3, maxLookback - offset, count - rows.length + 2);
    const batch = Array.from({ length: batchSize }, (_, i) =>
      dayjs(start).subtract(offset + i, 'day').format('YYYY-MM-DD')
    );
    offset += batchSize;

    const part = await Promise.all(batch.map((iso) => historyRowForDate(stationId, iso)));
    for (const row of part) {
      if (row) rows.push(row);
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(-count);
}

export async function listStationNames(limit = 2000): Promise<string[]> {
  const today = dayjs().format('YYYY-MM-DD');
  const initDate = await findNearestInitDate(today);
  if (!initDate) throw new Error('No recent AAQE forecast file found.');
  const points = await fetchForecastByInitDate(initDate);
  const byId = new Map<string, string>();
  for (const p of points) {
    const id = canonicalStationId(p.properties);
    const name = displayName(p.properties);
    if (id && name && !byId.has(id)) byId.set(id, name);
  }
  return [...byId.values()].sort((a, b) => a.localeCompare(b)).slice(0, limit);
}
