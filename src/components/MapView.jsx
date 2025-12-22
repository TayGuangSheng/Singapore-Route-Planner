import { useEffect, useRef } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '360px'
};

const defaultCenter = { lat: 1.3521, lng: 103.8198 };

const MapView = ({ isLoaded, loadError, startLocation, routeStops, endLocation, directions, t }) => {
  const mapRef = useRef(null);

  const center = startLocation || routeStops?.[0]?.latLng || defaultCenter;
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

  const cleanedPath = fallbackPath.filter(
    (point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
  );
  const fallbackKey = cleanedPath.map((point) => `${point.lat},${point.lng}`).join("|");

  const fitMapToPoints = () => {
    if (!isLoaded || !window.google?.maps || !mapRef.current || !cleanedPath.length) {
      return;
    }
    if (cleanedPath.length === 1) {
      mapRef.current.setCenter(cleanedPath[0]);
      mapRef.current.setZoom(14);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    cleanedPath.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds, { top: 48, right: 24, bottom: 48, left: 24 });
  };

  useEffect(() => {
    fitMapToPoints();
  }, [fallbackKey, isLoaded]);

  if (loadError) {
    return <div className="map-fallback">{t("mapsNotReady")}</div>;
  }
  if (!isLoaded) {
    return <div className="map-fallback">{t("mapsNotReady")}</div>;
  }

  return (
    <div className="map-card">
      <div className="map-title">{t("mapTitle")}</div>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={12}
        options={{
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false
        }}
        onLoad={(map) => {
          mapRef.current = map;
          fitMapToPoints();
        }}
      >
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              preserveViewport: true,
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#1f7a8c',
                strokeWeight: 6,
                strokeOpacity: 0.9
              }
            }}
          />
        )}
        {!directions && cleanedPath.length > 1 && (
          <Polyline
            path={cleanedPath}
            options={{
              strokeColor: '#1f7a8c',
              strokeWeight: 5,
              strokeOpacity: 0.6
            }}
          />
        )}
        {startLocation && (
          <Marker
            position={startLocation}
            label={{
              text: t("startLabel"),
              fontWeight: '700',
              fontSize: '14px',
              color: '#0f1b24'
            }}
          />
        )}
        {routeStops?.map((stop, index) => (
          <Marker
            key={stop.id}
            position={stop.latLng}
            label={{
              text: String(index + 1),
              fontWeight: '700',
              fontSize: '14px',
              color: '#0f1b24'
            }}
          />
        ))}
        {endLocation && (
          <Marker
            position={endLocation}
            label={{
              text: t("endLabel"),
              fontWeight: '700',
              fontSize: '14px',
              color: '#0f1b24'
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
};

export default MapView;
