export interface AqiCategory {
  min: number;
  max: number;
  label: string;
  shortLabel: string;
  color: string;
  textColor: string;
  message: string;
  noData?: boolean;
}

/** EPA-style AQI breakpoints — shared by the dial, forecast chips, and city table. */
export const AQI_CATEGORIES: AqiCategory[] = [
  {
    min: 0,
    max: 50,
    label: 'Good',
    shortLabel: 'Good',
    color: '#00e400',
    textColor: '#111827',
    message: 'Air quality is satisfactory. It poses little to no health risk.',
  },
  {
    min: 51,
    max: 100,
    label: 'Moderate',
    shortLabel: 'Moderate',
    color: '#ffff00',
    textColor: '#111827',
    message:
      'Air quality is acceptable. Unusually sensitive individuals should consider limiting prolonged outdoor exertion.',
  },
  {
    min: 101,
    max: 150,
    label: 'Unhealthy for Sensitive Groups',
    shortLabel: 'USG',
    color: '#ff7e00',
    textColor: '#111827',
    message:
      'Sensitive groups (children, older adults, and people with heart or lung conditions) should reduce prolonged outdoor exertion.',
  },
  {
    min: 151,
    max: 200,
    label: 'Unhealthy',
    shortLabel: 'Unhealthy',
    color: '#ff0000',
    textColor: '#ffffff',
    message: 'Everyone may begin to experience health effects. Sensitive groups should avoid prolonged outdoor exertion.',
  },
  {
    min: 201,
    max: 300,
    label: 'Very Unhealthy',
    shortLabel: 'Very Unhealthy',
    color: '#8f3f97',
    textColor: '#ffffff',
    message: 'Health alert: everyone may experience more serious health effects. Avoid outdoor exertion.',
  },
  {
    min: 301,
    max: 500,
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    color: '#7e0023',
    textColor: '#ffffff',
    message: 'Health warning of emergency conditions. Everyone should avoid all outdoor exertion.',
  },
];

export const AQI_SCALE_MAX = AQI_CATEGORIES[AQI_CATEGORIES.length - 1].max;

const NO_DATA_CATEGORY: AqiCategory = {
  min: 0,
  max: 0,
  label: 'No data',
  shortLabel: 'No data',
  color: '#374151',
  textColor: '#f9fafb',
  message: 'No forecast data is available for this station right now.',
  noData: true,
};

export function getAqiCategory(aqi: number | null | undefined): AqiCategory {
  if (aqi == null || !Number.isFinite(aqi)) return NO_DATA_CATEGORY;
  const clamped = Math.max(0, aqi);
  return AQI_CATEGORIES.find((c) => clamped <= c.max) ?? AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
}

/** EPA AQI color bar stops — used to paint the 7-day trend by value. */
const AQI_COLOR_STOPS: { aqi: number; color: string }[] = [
  { aqi: 0, color: '#00e400' },
  { aqi: 50, color: '#00e400' },
  { aqi: 100, color: '#ffff00' },
  { aqi: 150, color: '#ff7e00' },
  { aqi: 200, color: '#ff0000' },
  { aqi: 300, color: '#8f3f97' },
  { aqi: 500, color: '#7e0023' },
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
}

/** Smooth AQI-scale color for a numeric value (green → yellow → orange → red → purple). */
export function colorForAqi(aqi: number): string {
  const value = Math.min(AQI_SCALE_MAX, Math.max(0, aqi));
  for (let i = 1; i < AQI_COLOR_STOPS.length; i += 1) {
    const prev = AQI_COLOR_STOPS[i - 1];
    const next = AQI_COLOR_STOPS[i];
    if (value <= next.aqi) {
      const t = (value - prev.aqi) / (next.aqi - prev.aqi);
      const [r1, g1, b1] = hexToRgb(prev.color);
      const [r2, g2, b2] = hexToRgb(next.color);
      return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
    }
  }
  return AQI_COLOR_STOPS[AQI_COLOR_STOPS.length - 1].color;
}

export const AQI_TREND_STOPS = AQI_COLOR_STOPS;
