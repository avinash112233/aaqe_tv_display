import dayjs from 'dayjs';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { StationHistoryPoint } from '../api/forecast';
import { AQI_TREND_STOPS, colorForAqi } from '../utils/aqi';

interface Props {
  points: StationHistoryPoint[];
}

const PAD = { l: 44, r: 40, t: 22, b: 34 };

function yTicks(min: number, max: number): number[] {
  const lo = Math.max(0, Math.floor(min / 50) * 50);
  const hi = Math.max(lo + 50, Math.ceil(max / 50) * 50);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 50) ticks.push(v);
  return ticks;
}

interface PlotPoint {
  x: number;
  y: number;
  aqi: number;
  date: string;
  color: string;
}

/** Clean 7-day AQI chart matching the TV trend mock. */
export default function TrendSparkline({ points }: Props) {
  const gradId = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState({ w: 400, h: 186 });
  const W = box.w;
  const H = box.h;

  useLayoutEffect(() => {
    const host = svgRef.current?.parentElement;
    if (!host) return;
    const apply = () => {
      const r = host.getBoundingClientRect();
      if (r.width >= 80 && r.height >= 80) {
        setBox({ w: Math.round(r.width), h: Math.round(r.height) });
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const values = points.map((p) => p.aqi).filter((n): n is number => n != null);
  if (values.length === 0) {
    return <p className="dash-panel-empty">No 7-day trend yet.</p>;
  }

  const ticks = yTicks(Math.min(...values), Math.max(...values));
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const span = Math.max(50, max - min);
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const step = points.length > 1 ? plotW / (points.length - 1) : plotW;
  const yAt = (aqi: number) => PAD.t + plotH * (1 - (aqi - min) / span);
  const xAt = (i: number) => PAD.l + i * step;

  const coords: PlotPoint[] = points
    .map((p, i) =>
      p.aqi == null
        ? null
        : {
            x: xAt(i),
            y: yAt(p.aqi),
            aqi: Math.round(p.aqi),
            date: p.date,
            color: colorForAqi(p.aqi),
          }
    )
    .filter((c): c is PlotPoint => c != null);

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const yHigh = yAt(AQI_TREND_STOPS[AQI_TREND_STOPS.length - 1].aqi);
  const yLow = yAt(AQI_TREND_STOPS[0].aqi);
  const ySpan = yLow - yHigh || 1;
  const axisTop = yAt(max);
  const axisBot = yAt(min);
  const axisLeft = PAD.l;
  const axisRight = W - PAD.r;
  const first = coords[0];
  const lastPt = coords[coords.length - 1];
  const area = line ? `${line} L ${lastPt.x} ${axisBot} L ${first.x} ${axisBot} Z` : '';
  const shadeTop = Math.min(...coords.map((c) => c.y));
  const shadeXId = `${gradId}-x`;
  const shadeFadeId = `${gradId}-fade`;
  const shadeMaskId = `${gradId}-mask`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="dash-trend-svg"
      role="img"
      aria-label="Seven-day daily AQI trend"
    >
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1={yHigh} x2="0" y2={yLow}>
          {[...AQI_TREND_STOPS]
            .map((stop) => ({
              aqi: stop.aqi,
              offset: (yAt(stop.aqi) - yHigh) / ySpan,
              color: colorForAqi(stop.aqi),
            }))
            .sort((a, b) => a.offset - b.offset)
            .map((stop) => (
              <stop key={stop.aqi} offset={stop.offset} stopColor={stop.color} />
            ))}
        </linearGradient>
        <linearGradient
          id={shadeXId}
          gradientUnits="userSpaceOnUse"
          x1={first.x}
          y1="0"
          x2={lastPt.x}
          y2="0"
        >
          {coords.map((c, i) => (
            <stop
              key={c.date}
              offset={coords.length === 1 ? 0 : i / (coords.length - 1)}
              stopColor={c.color}
            />
          ))}
        </linearGradient>
        <linearGradient id={shadeFadeId} gradientUnits="userSpaceOnUse" x1="0" y1={shadeTop} x2="0" y2={axisBot}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={shadeMaskId}>
          <rect x={axisLeft} y={PAD.t} width={plotW} height={plotH + 2} fill={`url(#${shadeFadeId})`} />
        </mask>
      </defs>

      {ticks.map((t) => (
        <line key={`g-${t}`} x1={axisLeft} y1={yAt(t)} x2={axisRight} y2={yAt(t)} className="dash-trend-grid" />
      ))}
      <line x1={axisLeft} y1={axisTop} x2={axisLeft} y2={axisBot} className="dash-trend-grid" />

      <text
        x={14}
        y={(axisTop + axisBot) / 2}
        className="dash-trend-axis-title"
        textAnchor="middle"
        transform={`rotate(-90 14 ${(axisTop + axisBot) / 2})`}
      >
        AQI
      </text>

      {ticks.map((t) => (
        <text
          key={`y-${t}`}
          x={axisLeft - 7}
          y={yAt(t)}
          className="dash-trend-axis-label"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {t}
        </text>
      ))}

      {points.map((p, i) => {
        const first = i === 0;
        const last = i === points.length - 1;
        return (
          <text
            key={`x-${p.date}`}
            x={xAt(i)}
            y={axisBot + 14}
            className="dash-trend-axis-label"
            textAnchor={first ? 'start' : last ? 'end' : 'middle'}
          >
            {dayjs(p.date).format('M/D')}
          </text>
        );
      })}

      <text x={(axisLeft + axisRight) / 2} y={H - 6} className="dash-trend-axis-title" textAnchor="middle">
        Date
      </text>

      {area && <path d={area} fill={`url(#${shadeXId})`} mask={`url(#${shadeMaskId})`} />}

      {line && (
        <path
          d={line}
          stroke={`url(#${gradId})`}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {coords.map((c, i) => {
        const first = i === 0;
        const last = i === coords.length - 1;
        return (
          <g key={`pt-${c.date}`}>
            <circle cx={c.x} cy={c.y} r={4} fill={c.color} />
            <text
              x={first ? c.x + 6 : last ? c.x - 6 : c.x}
              y={c.y - 9}
              className="dash-trend-value"
              textAnchor={first ? 'start' : last ? 'end' : 'middle'}
            >
              {c.aqi}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
