import dayjs from 'dayjs';
import type { StationHistoryPoint } from '../api/forecast';
import { getAqiCategory } from '../utils/aqi';

interface Props {
  points: StationHistoryPoint[];
}

const W = 680;
const H = 268;
const PAD = { l: 64, r: 20, t: 30, b: 68 };

export default function HistoricalAqiChart({ points }: Props) {
  const values = points.map((p) => p.aqi).filter((n): n is number => n != null);
  const maxAqi = values.length ? Math.max(...values) : 0;
  const maxY = Math.max(100, Math.ceil(maxAqi / 50) * 50);
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const slot = points.length > 0 ? plotW / points.length : plotW;
  const barW = Math.min(38, slot * 0.48);
  const axisY = PAD.t + plotH;
  const axisX = PAD.l;

  const yAt = (aqi: number) => PAD.t + plotH * (1 - aqi / maxY);
  const ticks = Array.from({ length: maxY / 50 + 1 }, (_, i) => i * 50);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dash-history-svg" role="img" aria-label="Daily AQI for the last seven days">
      {ticks.map((tick) => {
        const y = yAt(tick);
        return (
          <g key={tick}>
            {tick > 0 && <line x1={axisX} y1={y} x2={W - PAD.r} y2={y} className="dash-history-grid" />}
            <line x1={axisX - 5} y1={y} x2={axisX} y2={y} className="dash-history-tick" />
            <text x={axisX - 10} y={y} className="dash-history-axis" textAnchor="end" dominantBaseline="middle">
              {tick}
            </text>
          </g>
        );
      })}

      <line x1={axisX} y1={PAD.t} x2={axisX} y2={axisY} className="dash-history-spine" />
      <line x1={axisX} y1={axisY} x2={W - PAD.r} y2={axisY} className="dash-history-spine" />

      <text
        x={18}
        y={PAD.t + plotH / 2}
        className="dash-history-axis-title"
        textAnchor="middle"
        transform={`rotate(-90 18 ${PAD.t + plotH / 2})`}
      >
        AQI
      </text>

      {points.map((p, i) => {
        const cat = getAqiCategory(p.aqi);
        const x = PAD.l + slot * i + slot / 2;
        const aqi = p.aqi ?? 0;
        const barH = p.aqi == null ? 0 : Math.max(4, plotH * (aqi / maxY));
        const y = yAt(aqi);
        return (
          <g key={p.date}>
            <line x1={x} y1={axisY} x2={x} y2={axisY + 5} className="dash-history-tick" />
            <rect x={x - barW / 2} y={y} width={barW} height={barH} rx={5} fill={cat.color} />
            {p.aqi != null && (
              <text x={x} y={y - 7} className="dash-history-value" textAnchor="middle">
                {Math.round(p.aqi)}
              </text>
            )}
            <text x={x} y={axisY + 18} className="dash-history-day" textAnchor="middle">
              {dayjs(p.date).format('ddd')}
            </text>
            <text x={x} y={axisY + 32} className="dash-history-date" textAnchor="middle">
              {dayjs(p.date).format('MMM D')}
            </text>
          </g>
        );
      })}

      <text x={axisX + plotW / 2} y={H - 8} className="dash-history-axis-title" textAnchor="middle">
        Date
      </text>
    </svg>
  );
}
