import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  loadStationDisplay,
  loadStationHistory,
  type StationDisplayData,
  type StationHistoryPoint,
} from '../api/forecast';
import { getAqiCategory } from '../utils/aqi';
import AqiGaugeDial from '../components/AqiGaugeDial';
import ForecastPanel from '../components/ForecastPanel';
import MapPanel from '../components/MapPanel';
import CityComparisonTable from '../components/CityComparisonTable';

const DEFAULT_REFRESH_MINUTES = Number(import.meta.env.VITE_REFRESH_MINUTES ?? '30');

function parseCoord(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export default function StationDisplay() {
  const [params] = useSearchParams();
  const station = params.get('station') ?? undefined;
  const lat = parseCoord(params.get('lat'));
  const lon = parseCoord(params.get('lon'));

  const [data, setData] = useState<StationDisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<StationHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const hasStationQuery = Boolean(station) || (lat != null && lon != null);

  const queryKey = useMemo(
    () => `${station ?? ''}|${lat ?? ''}|${lon ?? ''}`,
    [station, lat, lon]
  );

  const refresh = useCallback(async () => {
    if (!hasStationQuery) {
      setError(null);
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await loadStationDisplay({ station, lat, lon });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [station, lat, lon, hasStationQuery]);

  useEffect(() => {
    refresh();
  }, [refresh, queryKey]);

  useEffect(() => {
    const intervalMs = DEFAULT_REFRESH_MINUTES * 60 * 1000;
    const id = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!data?.stationId) return;
    let cancelled = false;
    setHistoryLoading(true);
    loadStationHistory(data.stationId, 7, data.initDate)
      .then((points) => {
        if (!cancelled) setHistory(points);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.stationId, data?.initDate]);

  const hero = data?.days[0] ?? null;
  const heroCat = getAqiCategory(hero?.aqi ?? null);

  if (!hasStationQuery) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="tv-root dash-root" style={{ ['--accent-color' as string]: heroCat.color }}>
      <header className="dash-header">
        <div className="dash-header-title">
          <h1>{data ? `${data.stationName} Air Quality Dashboard` : 'Air Quality Dashboard'}</h1>
        </div>
        <div className="dash-header-right">
          <div className="dash-date">
            {data
              ? dayjs(data.initDate).format('dddd, MMMM D, YYYY').toUpperCase()
              : '\u00a0'}
          </div>
          <div className="dash-meta">Data updates everyday.</div>
        </div>
      </header>

      <main className="dash-grid">
        {loading && !data && <div className="tv-state">Loading forecast…</div>}
        {error && <div className="tv-state tv-state-error">{error}</div>}

        {data && hero && (
          <>
            <section className="dash-panel dash-dial">
              <div className="dash-panel-header dash-dial-header">
                <span className="dash-panel-title">Current Forecast</span>
                <p className="dash-dial-units-note">All PM₂.₅ values are in µg/m³.</p>
              </div>
              <div className="aqi-dial-wrap">
                <AqiGaugeDial value={hero.aqi} pm25={hero.pm25} />
              </div>
              <div className="dash-dial-current">
                <span className="dash-dial-current-time">
                  {heroCat.noData ? 'No data' : heroCat.label}
                </span>
                <p className="dash-dial-health" style={{ color: heroCat.color }}>
                  {heroCat.message}
                </p>
              </div>
            </section>

            <MapPanel
              stationId={data.stationId}
              latitude={data.latitude}
              longitude={data.longitude}
              stations={data.mapStations}
              initDate={data.initDate}
            />

            <ForecastPanel days={data.days} history={history} historyLoading={historyLoading} />
            <CityComparisonTable cities={data.nearbyCities} />
          </>
        )}
      </main>
    </div>
  );
}
