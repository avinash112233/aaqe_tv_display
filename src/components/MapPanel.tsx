import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapStationPoint } from '../api/forecast';
import { loadPollutantGridOverlay } from '../api/pollutantGrid';
import { getAqiCategory } from '../utils/aqi';
import AqiScaleLegend from './AqiScaleLegend';

interface Props {
  stationId: string;
  latitude: number;
  longitude: number;
  stations: MapStationPoint[];
  initDate?: string;
}

const REGIONAL_DEGREE_SPAN = 2;
type PollutantState = 'idle' | 'loading' | 'ready' | 'error';
type BaseLayerKind = 'streets' | 'satellite';

const STREET_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export default function MapPanel({ stationId, latitude, longitude, stations, initDate }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const streetsLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const hasUserInteractedRef = useRef(false);

  const pollutantLayerRef = useRef<L.ImageOverlay | null>(null);
  const pollutantCacheRef = useRef<{ dataUrl: string; bounds: L.LatLngBoundsExpression } | null>(null);
  const pollutantLoadRef = useRef<Promise<void> | null>(null);
  const [pollutantState, setPollutantState] = useState<PollutantState>('loading');
  const [baseLayer, setBaseLayer] = useState<BaseLayerKind>('streets');
  const [layersOpen, setLayersOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const el = containerRef.current;

    const map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      boxZoom: true,
      keyboard: true,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      preferCanvas: true,
    });

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    map.on('dragstart zoomstart', () => {
      hasUserInteractedRef.current = true;
    });

    streetsLayerRef.current = L.tileLayer(STREET_URL, {
      maxZoom: 12,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    satelliteLayerRef.current = L.tileLayer(SATELLITE_URL, {
      maxZoom: 12,
      attribution: 'Tiles &copy; Esri',
    });

    const pollutantPane = map.createPane('pollutant');
    pollutantPane.style.zIndex = '350';

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      pollutantLayerRef.current = null;
      streetsLayerRef.current = null;
      satelliteLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    hasUserInteractedRef.current = false;
  }, [stationId]);

  useEffect(() => {
    const map = mapRef.current;
    const streets = streetsLayerRef.current;
    const satellite = satelliteLayerRef.current;
    if (!map || !streets || !satellite) return;
    if (baseLayer === 'satellite') {
      if (map.hasLayer(streets)) map.removeLayer(streets);
      if (!map.hasLayer(satellite)) satellite.addTo(map);
    } else {
      if (map.hasLayer(satellite)) map.removeLayer(satellite);
      if (!map.hasLayer(streets)) streets.addTo(map);
    }
  }, [baseLayer]);

  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      window.setTimeout(() => mapRef.current?.invalidateSize(), 80);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const attachPollutantOverlay = useCallback((dataUrl: string, bounds: L.LatLngBoundsExpression) => {
    const map = mapRef.current;
    if (!map) return;
    if (pollutantLayerRef.current && map.hasLayer(pollutantLayerRef.current)) {
      map.removeLayer(pollutantLayerRef.current);
    }
    pollutantLayerRef.current = L.imageOverlay(dataUrl, bounds, {
      opacity: 0.55,
      pane: 'pollutant',
      interactive: false,
    }).addTo(map);
    setPollutantState('ready');
  }, []);

  const showPollutantOverlay = useCallback(async () => {
    let cached = pollutantCacheRef.current;
    if (!cached) {
      setPollutantState('loading');
      if (!pollutantLoadRef.current) {
        pollutantLoadRef.current = loadPollutantGridOverlay(initDate)
          .then((overlay) => {
            pollutantCacheRef.current = { dataUrl: overlay.dataUrl, bounds: overlay.bounds };
          })
          .finally(() => {
            pollutantLoadRef.current = null;
          });
      }
      try {
        await pollutantLoadRef.current;
      } catch (err) {
        console.error('Pollutant grid overlay failed to load:', err);
        setPollutantState('error');
        return;
      }
      cached = pollutantCacheRef.current;
    }
    if (!cached || !mapRef.current) return;
    attachPollutantOverlay(cached.dataUrl, cached.bounds);
  }, [attachPollutantOverlay, initDate]);

  useEffect(() => {
    pollutantCacheRef.current = null;
  }, [initDate]);

  useEffect(() => {
    void showPollutantOverlay();
  }, [showPollutantOverlay]);

  const handleFullscreen = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }, []);

  const handleSelectBase = useCallback((kind: BaseLayerKind) => {
    setBaseLayer(kind);
    setLayersOpen(false);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    map.invalidateSize();
    layerGroup.clearLayers();

    const plotted: MapStationPoint[] = stations.filter((s) => s.id === stationId);
    if (plotted.length === 0) {
      plotted.push({
        id: stationId,
        name: stationId,
        latitude,
        longitude,
        aqi: null,
        pm25: null,
      });
    }
    plotted.forEach((s) => {
      const cat = getAqiCategory(s.aqi);
      L.circleMarker([s.latitude, s.longitude], {
        radius: 14,
        color: '#f8fafc',
        weight: 3,
        fillColor: cat.color,
        fillOpacity: 0.9,
      })
        .bindTooltip(`${s.name} · ${s.aqi != null ? Math.round(s.aqi) : '—'} AQI`, {
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          className: 'dash-map-tooltip',
        })
        .addTo(layerGroup);
    });

    if (hasUserInteractedRef.current) return;

    const bounds = L.latLngBounds(
      [latitude - REGIONAL_DEGREE_SPAN / 2, longitude - REGIONAL_DEGREE_SPAN / 2],
      [latitude + REGIONAL_DEGREE_SPAN / 2, longitude + REGIONAL_DEGREE_SPAN / 2]
    );
    map.fitBounds(bounds, { padding: [12, 12] });
  }, [stations, stationId, latitude, longitude]);

  return (
    <section className="dash-panel dash-map">
      <div ref={canvasRef} className="dash-map-canvas">
        <div ref={containerRef} className="dash-map-leaflet" />

        <div className="dash-map-overlay">
          <div className="dash-map-overlay-left">
            <button
              type="button"
              className={layersOpen ? 'dash-map-toolbar-active' : undefined}
              onClick={() => setLayersOpen((open) => !open)}
            >
              <LayersIcon />
              Map Layers
            </button>
            {layersOpen && (
              <div className="dash-map-layers-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={baseLayer === 'streets' ? 'dash-map-toolbar-active' : undefined}
                  onClick={() => handleSelectBase('streets')}
                >
                  Streets
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={baseLayer === 'satellite' ? 'dash-map-toolbar-active' : undefined}
                  onClick={() => handleSelectBase('satellite')}
                >
                  Satellite
                </button>
              </div>
            )}
          </div>

          <div className="dash-map-overlay-right">
            <button type="button" onClick={handleFullscreen} aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}>
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>

        {pollutantState === 'error' && (
          <p className="dash-map-overlay-error">Pollutant grid failed to load</p>
        )}

        <div className="dash-map-scale">
          <AqiScaleLegend />
        </div>
      </div>
    </section>
  );
}

function LayersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 3 8l9 5 9-5-9-5Zm0 18 9-5-9-5-9 5 9 5Zm0-7.5 9-5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
