import { useEffect, useMemo, useState } from 'react';
import LanguageToggle from './components/LanguageToggle.jsx';
import StopInputs from './components/StopInputs.jsx';
import AddressAutocomplete from './components/AddressAutocomplete.jsx';
import MapView from './components/MapView.jsx';
import RouteList from './components/RouteList.jsx';
import SavedLocations from './components/SavedLocations.jsx';
import UiIcon from './components/UiIcon.jsx';
import { translations, getInitialLanguage, LANGUAGE_STORAGE_KEY } from './i18n.js';
import { geocodeLocation, getDistanceMatrix, getRouteDetails } from './services/oneMap.js';
import { applyTwoOpt, buildNearestNeighborOrder } from './utils/routeOptimization.js';
import { formatDistance, formatDuration } from './utils/formatters.js';

const MAX_STOPS = 20;
const DEFAULT_STOP_MINUTES = 5;
const DEFAULT_VEHICLE_SPEED_KMH = 30;
const SAVED_LOCATIONS_STORAGE_KEY = 'route_planner_saved_locations';

const createStopId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeLocationInput = (value) => {
  const collapsed = value.replace(/\s+/g, ' ');
  const digitsOnly = collapsed.replace(/\s/g, '');
  if (/^[\d\s]+$/.test(collapsed) && /^\d+$/.test(digitsOnly)) {
    return digitsOnly.slice(0, 6);
  }
  return collapsed.replace(/^\s+/, '');
};
const normalizeSavedLocationName = (value) => value.replace(/\s+/g, ' ').trim();
const getFilledStops = (items) => items.filter((stop) => stop.postal.trim());

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
const normalizeVehicleSpeedKmh = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_VEHICLE_SPEED_KMH;
  }
  return Math.min(Math.max(parsed, 5), 120);
};

const App = () => {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [startPostal, setStartPostal] = useState('');
  const [startLatLng, setStartLatLng] = useState(null);
  const [endPostal, setEndPostal] = useState('');
  const [savedLocations, setSavedLocations] = useState(getInitialSavedLocations);
  const [savedLocationName, setSavedLocationName] = useState('');
  const [savedLocationValue, setSavedLocationValue] = useState('');
  const [defaultStopMinutes, setDefaultStopMinutes] = useState(DEFAULT_STOP_MINUTES);
  const [vehicleSpeedKmh, setVehicleSpeedKmh] = useState(DEFAULT_VEHICLE_SPEED_KMH);
  const [stops, setStops] = useState([
    { id: createStopId(), postal: '' },
    { id: createStopId(), postal: '' }
  ]);
  const [routeData, setRouteData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

  const resolveSavedLocationValue = (value) => {
    const normalizedValue = normalizeSavedLocationName(value).toLowerCase();
    if (!normalizedValue) {
      return value;
    }

    const savedLocation = savedLocations.find(
      (location) => location.name.toLowerCase() === normalizedValue
    );
    return savedLocation?.value || value;
  };

  const handleStartChange = (value) => {
    setStartPostal(normalizeLocationInput(value));
    setStartLatLng(null);
    setIsLocating(false);
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

  const handleVehicleSpeedChange = (value) => {
    const speedKmh = normalizeVehicleSpeedKmh(value);
    setVehicleSpeedKmh(speedKmh);
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
      setStartLatLng(null);
      setIsLocating(false);
    } else {
      setEndPostal(savedLocation.value);
    }
    setRouteData(null);
  };

  const handleUseSavedForStart = (id) => {
    applySavedLocation(id, 'start');
  };

  const handleUseCurrentLocation = () => {
    if (!navigator?.geolocation) {
      setStartLatLng(null);
      setIsLocating(false);
      setErrors([t('geoNotSupported')]);
      return;
    }
    setErrors([]);
    setStartLatLng(null);
    setIsLocating(true);
    setStartPostal(t('locating'));
    setRouteData(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setStartLatLng({ lat, lng });
        setStartPostal(t('currentLocationLabel'));
        setIsLocating(false);
      },
      (err) => {
        setStartLatLng(null);
        setStartPostal('');
        setIsLocating(false);
        setErrors([err?.message || t('geoNotSupported')]);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
    const filledStops = getFilledStops(stops);
    const resolvedStartPostal = resolveSavedLocationValue(startPostal);
    const resolvedEndPostal = resolveSavedLocationValue(endPostal);

    if (!startPostal.trim()) {
      validationErrors.push(t('missingStart'));
    } else if (isNumericOnly(resolvedStartPostal) && !isValidPostal(resolvedStartPostal)) {
      validationErrors.push(t('invalidPostal'));
    }

    if (!filledStops.length && !endPostal.trim()) {
      validationErrors.push(t('missingStops'));
    }

    stops.forEach((stop, index) => {
      const resolvedStopPostal = resolveSavedLocationValue(stop.postal);
      if (
        stop.postal.trim() &&
        isNumericOnly(resolvedStopPostal) &&
        !isValidPostal(resolvedStopPostal)
      ) {
        validationErrors.push(`${t('invalidStop')} ${index + 1}`);
      }
    });

    if (endPostal.trim() && isNumericOnly(resolvedEndPostal) && !isValidPostal(resolvedEndPostal)) {
      validationErrors.push(t('invalidEnd'));
    }

    return validationErrors;
  };

  const handleOptimize = async () => {
    setErrors([]);
    if (isLocating) {
      setErrors([t('locating')]);
      return;
    }

    const validationErrors = validateInputs();
    if (validationErrors.length) {
      setErrors(validationErrors);
      return;
    }

    setIsOptimizing(true);

    try {
      const warningMessages = [];
      const filledStops = getFilledStops(stops).map((stop) => ({
        ...stop,
        resolvedPostal: resolveSavedLocationValue(stop.postal)
      }));
      const resolvedStartPostal = resolveSavedLocationValue(startPostal);
      const resolvedEndPostal = resolveSavedLocationValue(endPostal);
      let startLocation = null;
      if (startLatLng) {
        startLocation = startLatLng;
      } else {
        startLocation = await geocodeLocation(resolvedStartPostal);
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
      }

      const stopLocations = [];
      for (const stop of filledStops) {
        stopLocations.push(await geocodeLocation(stop.resolvedPostal));
      }

      const failedStops = stopLocations
        .map((location, index) => (location ? null : filledStops[index].postal))
        .filter(Boolean);

      if (failedStops.length) {
        setErrors(failedStops.map((postal) => `${t('geocodeFail')}: ${postal}`));
        setIsOptimizing(false);
        return;
      }
      const mismatchStops = stopLocations
        .map((location, index) => (location?.postalMismatch ? filledStops[index].postal : null))
        .filter(Boolean);
      if (mismatchStops.length) {
        setErrors(mismatchStops.map((postal) => `${t('postalMismatch')}: ${postal}`));
        setIsOptimizing(false);
        return;
      }

      const endLocation = endPostal ? await geocodeLocation(resolvedEndPostal) : null;
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
      const routeStartLatLng = { lat: startLocation.lat, lng: startLocation.lng };
      const endLatLng = endLocation ? { lat: endLocation.lat, lng: endLocation.lng } : null;

      const locations = endLatLng
        ? [routeStartLatLng, ...stopLatLngs, endLatLng]
        : [routeStartLatLng, ...stopLatLngs];
      const speedOptions = { averageSpeedKmh: vehicleSpeedKmh };
      const { distanceMatrix, durationMatrix } = await getDistanceMatrix(locations, speedOptions);

      const endIndex = endLocation ? distanceMatrix.length - 1 : null;
      const optimizationOptions = { endIndex };
      let order = buildNearestNeighborOrder(distanceMatrix, optimizationOptions);
      order = applyTwoOpt(order, distanceMatrix, optimizationOptions);

      if (order.length !== filledStops.length) {
        setErrors([t('matrixFail')]);
        setIsOptimizing(false);
        return;
      }

      const orderedStops = order.map((matrixIndex) => {
        const stopIndex = matrixIndex - 1;
        const stop = filledStops[stopIndex];
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

      let totalDistance = computeTotal(distanceMatrix, endIndex);
      let baseDuration = computeTotal(durationMatrix, endIndex);
      const stopSeconds = orderedStops.length * (defaultStopMinutes || 0) * 60;

      if (totalDistance === null || baseDuration === null) {
        setErrors([t('matrixFail')]);
        setIsOptimizing(false);
        return;
      }

      const routeDetails = await getRouteDetails(routeStartLatLng, orderedStops, endLatLng, speedOptions);
      if (routeDetails.totalDistance !== null && routeDetails.totalDuration !== null) {
        totalDistance = routeDetails.totalDistance;
        baseDuration = routeDetails.totalDuration;
      }
      if (routeDetails.isApproximate && !warningMessages.includes(t('routeApproximation'))) {
        warningMessages.push(t('routeApproximation'));
      }
      const totalDuration = baseDuration + stopSeconds;

      setRouteData({
        startPostal,
        startLocation: routeStartLatLng,
        stops: orderedStops,
        totalDistance,
        totalDuration,
        routePath: routeDetails.path,
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

  const handleNavigate = (stop, preferredApp = 'google') => {
    if (!stop.latLng) {
      return;
    }
    const { lat, lng } = stop.latLng;
    const url =
      preferredApp === 'waze'
        ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.location.href = url;
  };

  const nextStopId = routeData?.stops.find((stop) => !stop.delivered)?.id || null;
  const deliveredCount = routeData?.stops.filter((stop) => stop.delivered).length || 0;
  const readyStopCount = getFilledStops(stops).length;
  const hasRouteTarget = readyStopCount > 0 || Boolean(endPostal.trim());
  const canOptimize = !isOptimizing && !isLocating && Boolean(startPostal.trim()) && hasRouteTarget;
  const endStop = routeData?.endLocation
    ? { postal: routeData.endPostal, latLng: routeData.endLocation, address: routeData.endAddress }
    : null;
  const shellClassName = routeData ? 'app-shell has-route' : 'app-shell';
  const totalDistanceLabel = routeData ? formatDistance(routeData.totalDistance, t) : '--';
  const totalDurationLabel = routeData ? formatDuration(routeData.totalDuration, t) : '--';

  return (
    <div className={shellClassName}>
      <header className="app-header">
        <div className="app-brand">
          <span className="app-mark" aria-hidden="true">
            <UiIcon name="route" />
          </span>
          <div className="app-title-block">
            <h1>{t('appTitle')}</h1>
            <p>{t('appTagline')}</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="header-language">
            <UiIcon name="globe" />
            <LanguageToggle language={language} onChange={setLanguage} label={t('language')} />
          </div>
          <button
            type="button"
            className={isSettingsOpen ? 'header-icon-button active' : 'header-icon-button'}
            aria-label={t('settings')}
            aria-expanded={isSettingsOpen}
            title={t('settings')}
            onClick={() => setIsSettingsOpen((current) => !current)}
          >
            <UiIcon name="settings" />
          </button>
        </div>
      </header>

      {isSettingsOpen && (
        <section className="settings-panel" aria-label={t('settings')}>
          <div className="settings-panel-header">
            <h2>{t('settings')}</h2>
            <button
              type="button"
              className="settings-close-button"
              aria-label={t('closeSettings')}
              title={t('closeSettings')}
              onClick={() => setIsSettingsOpen(false)}
            >
              <UiIcon name="close" />
            </button>
          </div>

          <section className="settings-section" aria-label={t('routeOptions')}>
            <h3>{t('routeOptions')}</h3>
            <div className="options-grid">
              <label className="field-group">
                <span>{t('stopTimeLabel')}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="240"
                  step="1"
                  value={defaultStopMinutes}
                  onChange={(event) => handleDefaultStopTimeChange(event.target.value)}
                />
              </label>
              <label className="field-group">
                <span>{t('vehicleSpeedLabel')}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="5"
                  max="120"
                  step="1"
                  value={vehicleSpeedKmh}
                  onChange={(event) => handleVehicleSpeedChange(event.target.value)}
                />
              </label>
            </div>
          </section>

          <SavedLocations
            className="saved-panel settings-saved-panel"
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
        </section>
      )}

      <main className="app-main">
        <section className="planner-panel">
          <AddressAutocomplete
            inputClassName="start-location-input"
            wrapperClassName="start-location-field"
            placeholder={t('startPostalPlaceholder')}
            value={startPostal}
            savedLocations={savedLocations}
            onChange={handleStartChange}
            showUseCurrent
            onUseCurrent={handleUseCurrentLocation}
            isUsingCurrent={isLocating}
            ariaLabel={t('startPostalLabel')}
            t={t}
          />

          {savedLocations.length > 0 && (
            <div className="saved-tray" aria-label={t('savedLocationsTitle')}>
              {savedLocations.slice(0, 6).map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  className="saved-chip"
                  onClick={() => applySavedLocation(loc.id, 'start')}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          )}

          <StopInputs
            className="planner-stops"
            stops={stops}
            savedLocations={savedLocations}
            onStopChange={handleStopChange}
            onAddStop={handleAddStop}
            onRemoveStop={handleRemoveStop}
            maxStops={MAX_STOPS}
            t={t}
          />

          <AddressAutocomplete
            inputClassName="end-location-input"
            wrapperClassName="end-location-field"
            placeholder={t('endPostalPlaceholder')}
            value={endPostal}
            savedLocations={savedLocations}
            onChange={handleEndChange}
            ariaLabel={t('endPostalLabel')}
            t={t}
          />
          {savedLocations.length > 0 && (
            <div className="saved-tray saved-tray-end" aria-label={t('savedLocationsTitle')}>
              {savedLocations.slice(0, 6).map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  className="saved-chip"
                  onClick={() => applySavedLocation(loc.id, 'end')}
                >
                  {loc.name}
                </button>
              ))}
            </div>
          )}

          {errors.length > 0 && (
            <section className="error-card">
              <h3>{t('errorsTitle')}</h3>
              <ul>
                {errors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            </section>
          )}

          <button
            type="button"
            className="primary-button optimize-button"
            onClick={handleOptimize}
            disabled={!canOptimize}
            aria-busy={isOptimizing}
          >
            <span className="button-with-icon">
              <UiIcon name={isOptimizing ? 'time' : 'optimize'} />
              <span>{isOptimizing ? t('optimizing') : t('optimize')}</span>
            </span>
          </button>
          {!canOptimize && <p className="inline-hint">{t('disableHint')}</p>}
        </section>

        {routeData && (
          <MapView
            startLocation={routeData.startLocation}
            routeStops={routeData.stops}
            endLocation={routeData.endLocation}
            routePath={routeData.routePath}
            t={t}
          />
        )}
        {!routeData && (
          <section className="empty-map">
            <UiIcon name="map" />
            <p>{t('readyHint')}</p>
          </section>
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

      {routeData && (
        <footer className="route-summary-bar">
          <div>
            <span>{t('totalDistance')}</span>
            <strong>{totalDistanceLabel}</strong>
          </div>
          <div className="summary-divider"></div>
          <div>
            <span>{t('totalTime')}</span>
            <strong>{totalDurationLabel}</strong>
          </div>
        </footer>
      )}

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
