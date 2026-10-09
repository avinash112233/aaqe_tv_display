import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStationNames } from '../api/forecast';

export default function HomePage() {
  const [stations, setStations] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listStationNames()
      .then((names) => {
        if (!cancelled) setStations(names);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stations.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((name) => name.toLowerCase().includes(q));
  }, [stations, query]);

  return (
    <div className="home-root">
      <header className="home-header">
        <h1>AAQE TV Display</h1>
        <p>Choose a station to open the full-screen forecast view.</p>
      </header>

      {loading && <p className="home-note">Loading station list…</p>}
      {error && <p className="home-error">{error}</p>}

      {!loading && !error && (
        <>
          <label className="home-search">
            <span className="home-search-label">Search stations</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a station name…"
              autoFocus
            />
          </label>
          <p className="home-note">
            {filtered.length} of {stations.length} stations
          </p>
          <ul className="home-station-list">
            {filtered.map((name) => (
              <li key={name}>
                <Link to={`/display?station=${encodeURIComponent(name)}`}>{name}</Link>
              </li>
            ))}
          </ul>
          {filtered.length === 0 && <p className="home-note">No stations match that search.</p>}
        </>
      )}
    </div>
  );
}
