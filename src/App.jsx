import { useEffect, useMemo, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import LanguageToggle from './components/LanguageToggle.jsx';
import StopInputs from './components/StopInputs.jsx';
import MapView from './components/MapView.jsx';
import RouteList from './components/RouteList.jsx';
import SavedLocations from './components/SavedLocations.jsx';
import UiIcon from './components/UiIcon.jsx';
import { translations, getInitialLanguage, LANGUAGE_STORAGE_KEY } from './i18n.js';
import { geocodePostal, getDistanceMatrix, GOOGLE_MAPS_API_KEY } from './services/googleMaps.js';
import { applyTwoOpt, buildNearestNeighborOrder } from './utils/routeOptimization.js';
import { formatDistance, formatDuration } from './utils/formatters.js';

const MAX_STOPS = 20;
const DEFAULT_STOP_MINUTES = 5;
const SAVED_LOCATIONS_STORAGE_KEY = 'route_planner_saved_locations';

const createStopId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeLocationInput = (value) => {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  const digitsOnly = trimmed.replace(/\s/g, '');
  if (/^\d+$/.test(digitsOnly)) {
    return digitsOnly.slice(0, 6);
  }
  return trimmed;
};
const normalizeSavedLocationName = (value) => value.replace(/\s+/g, ' ').trim();

const getInitialSavedLocations = () => {
  try {
    const stored = localStorage.getItem(SAVED_LOCATIONS_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((location) => {
        const name = normalizeSavedLocationName(String(location?.name || ''));
        const value = normalizeLocationInput(String(location?.value || location?.postal || ''));
        if (!name || !value) {
          return null;
        }
        return {
          id: typeof location?.id === 'string' && location.id ? location.id : createStopId(),
          name,
          value
        };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
};

const isNumericOnly = (value) => /^\d+$/.test(value.trim());
const isValidPostal = (postal) => /^\d{6}$/.test(postal.trim());
const normalizeStopMinutes = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.min(Math.max(parsed, 0), 240);
};

const App = () => {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [startPostal, setStartPostal] = useState('');
  const [endPostal, setEndPostal] = useState('');
  const [savedLocations, setSavedLocations] = useState(getInitialSavedLocations);
  const [savedLocationName, setSavedLocationName] = useState('');
  const [savedLocationValue, setSavedLocationValue] = useState('');
  const [defaultStopMinutes, setDefaultStopMinutes] = useState(DEFAULT_STOP_MINUTES);
  const [stops, setStops] = useState([{ id: createStopId(), postal: '' }]);
  const [routeData, setRouteData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [navApp, setNavApp] = useState('google');

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: []
  });

  const t = useMemo(() => {
    const dictionary = translations[language] || translations.en;
    return (key) => dictionary[key] || key;
  }, [language]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem(SAVED_LOCATIONS_STORAGE_KEY, JSON.stringify(savedLocations));
  }, [savedLocations]);

  const handleStartChange = (value) => {
    setStartPostal(normalizeLocationInput(value));
    setRouteData(null);
  };

  const handleEndChange = (value) => {
    setEndPostal(normalizeLocationInput(value));
    setRouteData(null);
  };

  const handleStopChange = (id, value) => {
    setStops((prev) =>
      prev.map((stop) => (stop.id === id ? { ...stop, postal: normalizeLocationInput(value) } : stop))
    );
    setRouteData(null);
  };

  const handleDefaultStopTimeChange = (value) => {
    const minutes = normalizeStopMinutes(value);
    setDefaultStopMinutes(minutes);
    setRouteData(null);
  };

  const handleSavedLocationNameChange = (value) => {
    setSavedLocationName(value);
  };

  const handleSavedLocationValueChange = (value) => {
    setSavedLocationValue(normalizeLocationInput(value));
  };

  const handleAddSavedLocation = () => {
    const nextName = normalizeSavedLocationName(savedLocationName);
    const nextValue = normalizeLocationInput(savedLocationValue);
    const validationErrors = [];

    if (!nextName) {
      validationErrors.push(t('missingSavedName'));
    }
    if (!nextValue) {
      validationErrors.push(t('missingSavedLocation'));
    } else if (isNumericOnly(nextValue) && !isValidPostal(nextValue)) {
      validationErrors.push(t('invalidPostal'));
    }

    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    setSavedLocations((prev) => {
      const existingIndex = prev.findIndex(
        (location) => location.name.toLowerCase() === nextName.toLowerCase()
      );
      if (existingIndex >= 0) {
        return prev.map((location, index) =>
          index === existingIndex ? { ...location, name: nextName, value: nextValue } : location
        );
      }
      return [...prev, { id: createStopId(), name: nextName, value: nextValue }];
    });

    setSavedLocationName('');
    setSavedLocationValue('');
    setErrors([]);
  };

  const applySavedLocation = (id, target) => {
    const savedLocation = savedLocations.find((location) => location.id === id);
    if (!savedLocation) {
      return;
    }

    if (target === 'start') {
      setStartPostal(savedLocation.value);
    } else {
      setEndPostal(savedLocation.value);
    }
    setRouteData(null);
  };

  const handleUseSavedForStart = (id) => {
    applySavedLocation(id, 'start');
  };

  const handleUseSavedForEnd = (id) => {
    applySavedLocation(id, 'end');
  };

  const handleRemoveSavedLocation = (id) => {
    setSavedLocations((prev) => prev.filter((location) => location.id !== id));
    setRouteData(null);
  };

  const handleAddStop = () => {
    setStops((prev) => {
      if (prev.length >= MAX_STOPS) {
        return prev;
      }
      return [...prev, { id: createStopId(), postal: '' }];
    });
    setRouteData(null);
  };

  const handleRemoveStop = (id) => {
    setStops((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((stop) => stop.id !== id);
    });
    setRouteData(null);
  };

  const validateInputs = () => {
    const validationErrors = [];

    if (!startPostal.trim()) {
      validationErrors.push(t('missingStart'));
    } else if (isNumericOnly(startPostal) && !isValidPostal(startPostal)) {
      validationErrors.push(t('invalidPostal'));
    }

    if (stops.length < 2) {
      validationErrors.push(t('missingStops'));
    }

    stops.forEach((stop, index) => {
      if (!stop.postal.trim()) {
        validationErrors.push(`${t('missingStop')} ${index + 1}`);
      } else if (isNumericOnly(stop.postal) && !isValidPostal(stop.postal)) {
        validationErrors.push(`${t('invalidStop')} ${index + 1}`);
      }
    });

    if (endPostal.trim() && isNumericOnly(endPostal) && !isValidPostal(endPostal)) {
      validationErrors.push(t('invalidEnd'));
    }

    return validationErrors;
  };

  const getDirections = (origin, orderedStops, endLocation) => {
    if (!window.google?.maps) {
      return Promise.reject(new Error('Google Maps not loaded'));
    }

    const destination = endLocation || orderedStops[orderedStops.length - 1].latLng;
    const waypointStops = endLocation ? orderedStops : orderedStops.slice(0, -1);
    const waypoints = waypointStops.map((stop) => ({
      location: stop.latLng,
      stopover: true
    }));

    const service = new window.google.maps.DirectionsService();

    return new Promise((resolve, reject) => {
      service.route(
        {
          origin,
          destination,
          waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
          region: 'SG'
        },
        (result, status) => {
          if (status === 'OK') {
            resolve(result);
          } else {
            reject(new Error(status));
          }
        }
      );
    });
  };

  const handleOptimize = async () => {
    setErrors([]);
    if (!GOOGLE_MAPS_API_KEY) {
      setErrors([t('apiKeyMissing')]);
      return;
    }
    if (!isLoaded) {
      setErrors([t('mapsNotReady')]);
      return;
    }

    const validationErrors = validateInputs();
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    setIsOptimizing(true);

    try {
      const startLocation = await geocodePostal(startPostal);
      if (!startLocation) {
        setErrors([`${t('geocodeFail')}: ${startPostal}`]);
        setIsOptimizing(false);
        return;
      }
      if (startLocation.postalMismatch) {
        setErrors([`${t('postalMismatch')}: ${startPostal}`]);
        setIsOptimizing(false);
        return;
      }

      const stopLocations = await Promise.all(
        stops.map((stop) => geocodePostal(stop.postal))
      );

      const failedStops = stopLocations
        .map((location, index) => (location ? null : stops[index].postal))
        .filter(Boolean);

      if (failedStops.length) {
        setErrors(failedStops.map((postal) => `${t('geocodeFail')}: ${postal}`));
        setIsOptimizing(false);
        return;
      }
      const mismatchStops = stopLocations
        .map((location, index) => (location?.postalMismatch ? stops[index].postal : null))
        .filter(Boolean);
      if (mismatchStops.length) {
        setErrors(mismatchStops.map((postal) => `${t('postalMismatch')}: ${postal}`));
        setIsOptimizing(false);
        return;
      }

      const endLocation = endPostal ? await geocodePostal(endPostal) : null;
      if (endPostal && !endLocation) {
        setErrors([`${t('geocodeFail')}: ${endPostal}`]);
        setIsOptimizing(false);
        return;
      }
      if (endLocation?.postalMismatch) {
        setErrors([`${t('postalMismatch')}: ${endPostal}`]);
        setIsOptimizing(false);
        return;
      }

      const stopLatLngs = stopLocations.map((location) => ({
        lat: location.lat,
        lng: location.lng
      }));
      const startLatLng = { lat: startLocation.lat, lng: startLocation.lng };
      const endLatLng = endLocation ? { lat: endLocation.lat, lng: endLocation.lng } : null;

      const locations = endLatLng
        ? [startLatLng, ...stopLatLngs, endLatLng]
        : [startLatLng, ...stopLatLngs];
      const { distanceMatrix, durationMatrix } = await getDistanceMatrix(locations);

      const matrixForStops = endLocation
        ? distanceMatrix.slice(0, -1).map((row) => row.slice(0, -1))
        : distanceMatrix;

      let order = buildNearestNeighborOrder(matrixForStops);
      order = applyTwoOpt(order, matrixForStops);

      if (order.length !== stops.length) {
        setErrors([t('matrixFail')]);
        setIsOptimizing(false);
        return;
      }

      const orderedStops = order.map((matrixIndex) => {
        const stopIndex = matrixIndex - 1;
        const stop = stops[stopIndex];
        return {
          ...stop,
          latLng: stopLatLngs[stopIndex],
          address: stopLocations[stopIndex].address || '',
          delivered: false
        };
      });

      const computeTotal = (matrix, endIndex) => {
        let total = 0;
        let current = 0;
        for (const next of order) {
          const value = matrix[current]?.[next];
          if (typeof value !== 'number') {
            return null;
          }
          total += value;
          current = next;
        }
        if (endIndex !== null) {
          const value = matrix[current]?.[endIndex];
          if (typeof value !== 'number') {
            return null;
          }
          total += value;
        }
        return total;
      };

      const endIndex = endLocation ? distanceMatrix.length - 1 : null;
      const totalDistance = computeTotal(distanceMatrix, endIndex);
      const baseDuration = computeTotal(durationMatrix, endIndex);
      const stopSeconds = orderedStops.length * (defaultStopMinutes || 0) * 60;
      const totalDuration = baseDuration === null ? null : baseDuration + stopSeconds;

      if (totalDistance === null || totalDuration === null) {
        setErrors([t('matrixFail')]);
        setIsOptimizing(false);
        return;
      }

      let directions = null;
      const warningMessages = [];
      if (isLoaded) {
        try {
          directions = await getDirections(startLocation, orderedStops, endLocation);
        } catch (error) {
          warningMessages.push(t('directionsFail'));
        }
      } else {
        warningMessages.push(t('directionsFail'));
      }

      setRouteData({
        startPostal,
        startLocation: startLatLng,
        stops: orderedStops,
        totalDistance,
        totalDuration,
        directions,
        endPostal: endPostal || '',
        endLocation: endLatLng,
        endAddress: endLocation?.address || ''
      });

      if (warningMessages.length) {
        setErrors(warningMessages);
      }
    } catch (error) {
      setErrors([t('matrixFail')]);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleToggleDelivered = (id) => {
    setRouteData((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        stops: prev.stops.map((stop) =>
          stop.id === id ? { ...stop, delivered: !stop.delivered } : stop
        )
      };
    });
  };

  const handleNavigate = (stop) => {
    if (!stop.latLng) {
      return;
    }
    const { lat, lng } = stop.latLng;
    const url =
      navApp === 'waze'
        ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.location.href = url;
  };

  const nextStopId = routeData?.stops.find((stop) => !stop.delivered)?.id || null;
  const deliveredCount = routeData?.stops.filter((stop) => stop.delivered).length || 0;
  const readyStopCount = stops.filter((stop) => stop.postal.trim()).length;
  const canOptimize = !isOptimizing && startPostal.trim() && readyStopCount >= 2;
  const endStop = routeData?.endLocation
    ? { postal: routeData.endPostal, latLng: routeData.endLocation, address: routeData.endAddress }
    : null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="title-block">
          <h1>{t('appTitle')}</h1>
          {t('appTagline') && <p>{t('appTagline')}</p>}
        </div>
        <div className="header-language">
          <p className="eyebrow">{t('language')}</p>
          <LanguageToggle language={language} onChange={setLanguage} />
        </div>
      </header>

      <main className="app-main">
        <SavedLocations
          className="section-card section-saved"
          savedLocations={savedLocations}
          savedLocationName={savedLocationName}
          savedLocationValue={savedLocationValue}
          onSavedLocationNameChange={handleSavedLocationNameChange}
          onSavedLocationValueChange={handleSavedLocationValueChange}
          onAddSavedLocation={handleAddSavedLocation}
          onUseForStart={handleUseSavedForStart}
          onUseForEnd={handleUseSavedForEnd}
          onRemoveSavedLocation={handleRemoveSavedLocation}
          t={t}
        />

        <section className="card section-card section-start">
          <h2 className="title-with-icon">
            <UiIcon name="start" />
            <span>{t('startPostalLabel')}</span>
          </h2>
          <input
            type="text"
            inputMode="text"
            placeholder={t('startPostalPlaceholder')}
            value={startPostal}
            onChange={(event) => handleStartChange(event.target.value)}
          />
        </section>

        <StopInputs
          className="section-card section-stops"
          stops={stops}
          onStopChange={handleStopChange}
          onAddStop={handleAddStop}
          onRemoveStop={handleRemoveStop}
          maxStops={MAX_STOPS}
          t={t}
        />

        <section className="card section-card section-end">
          <h2 className="title-with-icon">
            <UiIcon name="end" />
            <span>{t('endPostalLabel')}</span>
          </h2>
          <input
            type="text"
            inputMode="text"
            placeholder={t('endPostalPlaceholder')}
            value={endPostal}
            onChange={(event) => handleEndChange(event.target.value)}
          />
        </section>

        <section className="card section-card section-time">
          <h2 className="title-with-icon">
            <UiIcon name="time" />
            <span>{t('stopTimeLabel')}</span>
          </h2>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="240"
            step="1"
            value={defaultStopMinutes}
            onChange={(event) => handleDefaultStopTimeChange(event.target.value)}
          />
        </section>

        <section className="card section-card section-nav">
          <div className="card-title-row">
            <h2 className="title-with-icon">
              <UiIcon name="navigation" />
              <span>{t('navigationApp')}</span>
            </h2>
          </div>
          <div className="toggle-row">
            <button
              type="button"
              className={navApp === 'google' ? 'chip active' : 'chip'}
              onClick={() => setNavApp('google')}
            >
              <span className="chip-content">
                <img src="/googlemaps-logo.svg" alt="" className="nav-logo" />
                <span>{t('googleMaps')}</span>
              </span>
            </button>
            <button
              type="button"
              className={navApp === 'waze' ? 'chip active' : 'chip'}
              onClick={() => setNavApp('waze')}
            >
              <span className="chip-content">
                <img src="/waze-logo.svg" alt="" className="nav-logo" />
                <span>{t('waze')}</span>
              </span>
            </button>
          </div>
        </section>

        {errors.length > 0 && (
          <section className="card error-card">
            <h3>{t('errorsTitle')}</h3>
            <ul>
              {errors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="card action-card">
          <button
            type="button"
            className="primary-button wide"
            onClick={handleOptimize}
            disabled={!canOptimize}
          >
            <span className="button-with-icon">
              <UiIcon name={isOptimizing ? 'time' : 'optimize'} />
              <span>{isOptimizing ? t('optimizing') : t('optimize')}</span>
            </span>
          </button>
          {!canOptimize && <p className="hint">{t('disableHint')}</p>}
        </section>

        {routeData && (
          <section className="card summary-card">
            <div>
              <p className="eyebrow">{t('totalDistance')}</p>
              <p className="summary-value">{formatDistance(routeData.totalDistance, t)}</p>
            </div>
            <div>
              <p className="eyebrow">{t('totalTime')}</p>
              <p className="summary-value">{formatDuration(routeData.totalDuration, t)}</p>
            </div>
          </section>
        )}

        {routeData && (
          <MapView
            isLoaded={isLoaded}
            loadError={loadError}
            startLocation={routeData.startLocation}
            routeStops={routeData.stops}
            endLocation={routeData.endLocation}
            directions={routeData.directions}
            t={t}
          />
        )}

        <RouteList
          routeStops={routeData?.stops}
          endStop={endStop}
          onToggleDelivered={handleToggleDelivered}
          onNavigate={handleNavigate}
          nextStopId={nextStopId}
          deliveredCount={deliveredCount}
          t={t}
        />
      </main>

      {isOptimizing && (
        <div className="loading-overlay" aria-live="polite">
          <div className="spinner"></div>
          <p>{t('optimizing')}</p>
        </div>
      )}
    </div>
  );
};

export default App;
