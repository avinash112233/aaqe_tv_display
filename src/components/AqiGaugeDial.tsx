import { AQI_CATEGORIES, formatPm25, getAqiCategory } from '../utils/aqi';
import {
  AQI_BREAKPOINTS,
  describeArc,
  describeSector,
  GAUGE_END_ANGLE,
  GAUGE_START_ANGLE,
  tickPoint,
  valueToAngle,
} from '../utils/gauge';

const CX = 190;
const CY = 188;
const BEZEL_R = 168;
const RING_OUTER_R = 148;
const RING_WIDTH = 20;
const RING_INNER_R = RING_OUTER_R - RING_WIDTH;
const FILL_R = RING_INNER_R - 3;
const TICK_INNER_R = RING_OUTER_R + 2;
const TICK_OUTER_R = RING_OUTER_R + 9;
const TICK_LABEL_R = RING_OUTER_R + 22;
const NEEDLE_R = FILL_R - 12;
const NEEDLE_HUB_R = 9;
const VIEW_W = CX * 2;
const VIEW_H = CY + NEEDLE_HUB_R + 8;
const TICK_VALUES = [50, 100, 150, 200, 300];

interface Props {
  value: number | null;
  pm25?: number | null;
}

export default function AqiGaugeDial({ value, pm25 = null }: Props) {
  const category = getAqiCategory(value);
  const hasValue = value != null && Number.isFinite(value);
  const clampedValue = hasValue ? Math.min(value as number, AQI_BREAKPOINTS[AQI_BREAKPOINTS.length - 1]) : null;
  const needleEnd = clampedValue != null ? tickPoint(CX, CY, NEEDLE_R, clampedValue) : null;
  const aqiText = hasValue ? String(Math.round(value as number)) : '—';
  const pmText = formatPm25(pm25);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMax meet"
      className="aqi-dial-svg"
      role="img"
      aria-label={`Air quality dial: ${category.label}`}
    >
      <path
        d={describeSector(CX, CY, BEZEL_R, GAUGE_START_ANGLE, GAUGE_END_ANGLE)}
        className="aqi-dial-bezel"
      />

      <path
        d={describeSector(CX, CY, FILL_R, GAUGE_START_ANGLE, GAUGE_END_ANGLE)}
        fill={category.color}
        className="aqi-dial-fill"
      />

      {AQI_CATEGORIES.map((c, i) => {
        const startAngle = valueToAngle(AQI_BREAKPOINTS[i]);
        const endAngle = valueToAngle(AQI_BREAKPOINTS[i + 1]);
        return (
          <path
            key={c.label}
            d={describeArc(CX, CY, RING_OUTER_R - RING_WIDTH / 2, startAngle, endAngle)}
            stroke={c.color}
            strokeWidth={RING_WIDTH}
            fill="none"
            strokeLinecap="butt"
          />
        );
      })}

      {TICK_VALUES.map((b) => {
        const inner = tickPoint(CX, CY, TICK_INNER_R, b);
        const outer = tickPoint(CX, CY, TICK_OUTER_R, b);
        const label = tickPoint(CX, CY, TICK_LABEL_R, b);
        return (
          <g key={b}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} className="aqi-dial-tick-mark" />
            <text x={label.x} y={label.y} className="aqi-dial-tick" textAnchor="middle" dominantBaseline="middle">
              {b}
            </text>
          </g>
        );
      })}

      {needleEnd && (
        <>
          <line
            x1={CX}
            y1={CY}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke="#0f172a"
            strokeWidth={7}
            strokeLinecap="round"
          />
          <line
            x1={CX}
            y1={CY}
            x2={needleEnd.x}
            y2={needleEnd.y}
            stroke="#f8fafc"
            strokeWidth={3.5}
            strokeLinecap="round"
            className="aqi-dial-needle"
          />
        </>
      )}

      <circle cx={CX} cy={CY} r={NEEDLE_HUB_R} className="aqi-dial-hub" />

      <text
        x={CX - FILL_R + 18}
        y={CY - 16}
        className="aqi-dial-metric"
        textAnchor="start"
        dominantBaseline="middle"
      >
        {`AQI = ${aqiText}`}
      </text>
      <text
        x={CX + FILL_R - 6}
        y={CY - 16}
        className="aqi-dial-metric"
        textAnchor="end"
        dominantBaseline="middle"
      >
        {`PM₂.₅ = ${pmText}`}
      </text>
    </svg>
  );
}
