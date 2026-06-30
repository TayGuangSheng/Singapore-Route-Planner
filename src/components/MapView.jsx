import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultCenter = { lat: 1.3521, lng: 103.8198 };
const oneMapTileUrl = 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png';
const oneMapAttribution =
  '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:16px;width:16px;vertical-align:middle;" alt="OneMap" />&nbsp;<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>&nbsp;&copy;&nbsp;contributors&nbsp;|&nbsp;<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>';

const isValidPoint = (point) =>
  point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng));

const toLeafletPoint = (point) => [Number(point.lat), Number(point.lng)];

const createMarkerIcon = (label, type = '') =>
  L.divIcon({
    className: `route-map-marker ${type}`.trim(),
    html: `<span>${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });

const MapView = ({ startLocation, routeStops, endLocation, routePath, t }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const fallbackPath = [];
  if (startLocation) {
    fallbackPath.push(startLocation);
  }
  if (routeStops?.length) {
    fallbackPath.push(...routeStops.map((stop) => stop.latLng));
  }
  if (endLocation) {
    fallbackPath.push(endLocation);
  }

  const cleanedFallbackPath = fallbackPath.filter(isValidPoint);
  const cleanedRoutePath = routePath?.filter(isValidPoint) || [];
  const displayPath = cleanedRoutePath.length > 1 ? cleanedRoutePath : cleanedFallbackPath;
  const pathKey = displayPath.map((point) => `${point.lat},${point.lng}`).join('|');
  const markerKey = cleanedFallbackPath.map((point) => `${point.lat},${point.lng}`).join('|');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return undefined;
    }

    const map = L.map(containerRef.current, {
      center: toLeafletPoint(startLocation || defaultCenter),
      zoom: 12,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer(oneMapTileUrl, {
      minZoom: 11,
      maxZoom: 19,
      attribution: oneMapAttribution
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) {
      return;
    }

    layerRef.current.clearLayers();

    if (displayPath.length > 1) {
      L.polyline(displayPath.map(toLeafletPoint), {
        color: '#1f6fae',
        weight: 5,
        opacity: 0.9
      }).addTo(layerRef.current);
    }

    if (isValidPoint(startLocation)) {
      L.marker(toLeafletPoint(startLocation), {
        icon: createMarkerIcon(t('startLabel'), 'start')
      }).addTo(layerRef.current);
    }

    routeStops?.forEach((stop, index) => {
      if (!isValidPoint(stop.latLng)) {
        return;
      }
      L.marker(toLeafletPoint(stop.latLng), {
        icon: createMarkerIcon(String(index + 1), stop.delivered ? 'delivered' : '')
      }).addTo(layerRef.current);
    });

    if (isValidPoint(endLocation)) {
      L.marker(toLeafletPoint(endLocation), {
        icon: createMarkerIcon(t('endLabel'), 'end')
      }).addTo(layerRef.current);
    }

    if (displayPath.length > 1) {
      mapRef.current.fitBounds(L.latLngBounds(displayPath.map(toLeafletPoint)), {
        padding: [24, 24]
      });
    } else if (displayPath.length === 1) {
      mapRef.current.setView(toLeafletPoint(displayPath[0]), 15);
    }

    window.setTimeout(() => mapRef.current?.invalidateSize(), 0);
  }, [pathKey, markerKey, startLocation, routeStops, endLocation, t]);

  return (
    <section className="map-card">
      <div className="leaflet-map" ref={containerRef} aria-label={t('mapTitle')} />
    </section>
  );
};

export default MapView;
