import type { NearbyCityAqi } from '../api/forecast';
import { formatPm25, getAqiCategory } from '../utils/aqi';

interface Props {
  cities: NearbyCityAqi[];
}

export default function CityComparisonTable({ cities }: Props) {
  return (
    <section className="dash-panel dash-cities">
      <div className="dash-panel-header">
        <span className="dash-panel-title">Today's Forecast for nearby cities</span>
      </div>
      {cities.length === 0 ? (
        <p className="dash-panel-empty">No nearby stations found in this feed.</p>
      ) : (
        <div className="dash-cities-row">
          {cities.map((c) => {
            const cat = getAqiCategory(c.aqi);
            return (
              <div key={c.name} className="dash-city-card" title={c.name}>
                <div className="dash-city-name">{c.name}</div>
                <div className="dash-city-aqi" style={{ background: cat.color, color: cat.textColor }}>
                  {c.aqi != null ? Math.round(c.aqi) : '—'}
                </div>
                <div className="dash-city-pm">
                  <span className="dash-city-pm-label">PM₂.₅</span>
                  <span className="dash-city-pm-value">
                    {formatPm25(c.pm25)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="dash-cities-source">
        Source: PM2.5 forecasts are generated using NASA&apos;s GEOS-FP and machine
        learning model supported by NASA&apos;s SNWG and HAQAST programs, and converted
        to AQI using US EPA guidelines. For more details contact (pawan.gupta@nasa.gov).
      </p>
    </section>
  );
}
