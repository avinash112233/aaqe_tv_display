/** Polar-coordinate helpers for the semicircular AQI dial. */

// True half-circle: 9 o'clock (0) -> 12 o'clock -> 3 o'clock (max), flat along the bottom.
export const GAUGE_START_ANGLE = -90;
export const GAUGE_END_ANGLE = 90;
export const GAUGE_SWEEP = GAUGE_END_ANGLE - GAUGE_START_ANGLE;

/** EPA breakpoints; each band gets an equal slice so 150 sits at 12 o'clock. */
export const AQI_BREAKPOINTS = [0, 50, 100, 150, 200, 300, 500];

export interface Point {
  x: number;
  y: number;
}

/** Maps an AQI value onto the dial. Each EPA category occupies an equal angle. */
export function valueToAngle(value: number, _scaleMax?: number): number {
  const bp = AQI_BREAKPOINTS;
  const n = bp.length - 1;
  const v = Math.min(Math.max(value, bp[0]), bp[n]);
  for (let i = 0; i < n; i++) {
    if (v <= bp[i + 1] || i === n - 1) {
      const span = bp[i + 1] - bp[i];
      const frac = span <= 0 ? 1 : Math.min(1, (v - bp[i]) / span);
      return GAUGE_START_ANGLE + ((i + frac) / n) * GAUGE_SWEEP;
    }
  }
  return GAUGE_END_ANGLE;
}

export function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

/** SVG arc path (clockwise) between two angles on the dial, for drawing colored track segments. */
export function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function tickPoint(cx: number, cy: number, r: number, value: number, scaleMax?: number): Point {
  return polarToCartesian(cx, cy, r, valueToAngle(value, scaleMax));
}

/** Closed semicircle (or any sector) from the center out to radius r. */
export function describeSector(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}
