import dayjs from 'dayjs';
import type { StationDayForecast, StationHistoryPoint } from '../api/forecast';
import { getAqiCategory } from '../utils/aqi';
import TrendSparkline from './TrendSparkline';

interface Props {
  days: StationDayForecast[];
  history: StationHistoryPoint[];
  historyLoading?: boolean;
}

function ForecastChip({ title, day }: { title: string; day: StationDayForecast }) {
  const cat = getAqiCategory(day.aqi);
  const aqiText = day.aqi != null ? String(Math.round(day.aqi)) : '—';
  return (
    <div className="dash-forecast-chip">
      <div className="dash-forecast-chip-title">{title}</div>
      <div className="dash-forecast-chip-date">{dayjs(day.date).format('ddd, MMM D')}</div>
      <span className="dash-forecast-aqi" style={{ background: cat.color, color: cat.textColor }}>
        {aqiText}
      </span>
      <div className="dash-forecast-chip-label" style={{ color: cat.color }}>
        {cat.shortLabel}
      </div>
    </div>
  );
}

/** The file's two forward days (Tomorrow / Day after from the issued date). */
export default function ForecastPanel({ days, history, historyLoading }: Props) {
  const chips: { title: string; day: StationDayForecast }[] = [];
  if (days[1]) chips.push({ title: 'Tomorrow', day: days[1] });
  if (days[2]) chips.push({ title: 'Day after', day: days[2] });

  return (
    <section className="dash-panel dash-forecast">
      <div className="dash-forecast-body">
        {chips.length === 0 && <p className="dash-panel-empty">No forecast days available.</p>}
        {chips.map(({ title, day }) => (
          <ForecastChip key={day.date} title={title} day={day} />
        ))}
        <div className="dash-forecast-trend">
          <div className="dash-forecast-chip-title">7-day trend</div>
          {historyLoading && <p className="dash-panel-empty">Loading…</p>}
          {!historyLoading && (
            <div className="dash-trend-plot">
              <TrendSparkline points={history} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
