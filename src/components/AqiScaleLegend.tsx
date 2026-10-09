import { AQI_CATEGORIES } from '../utils/aqi';

/** Static reference strip for the full EPA AQI scale — colored category row
 * on top, numeric range row underneath (same layout as the standard
 * AQI legend graphic). */
export default function AqiScaleLegend() {
  const isLast = (i: number) => i === AQI_CATEGORIES.length - 1;

  return (
    <div className="dash-scale-legend">
      {AQI_CATEGORIES.map((c) => (
        <div key={c.label} className="dash-scale-legend-cell" style={{ background: c.color, color: c.textColor }}>
          {c.shortLabel}
        </div>
      ))}
      {AQI_CATEGORIES.map((c, i) => (
        <div key={c.label} className="dash-scale-legend-cell dash-scale-legend-range">
          {isLast(i) ? `${c.min}+` : `${c.min}-${c.max}`}
        </div>
      ))}
    </div>
  );
}
