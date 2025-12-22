export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const assertMapsLoaded = () => {
  if (!window.google?.maps) {
    throw new Error("Google Maps is not loaded");
  }
};

const getComponent = (components, type) =>
  components?.find((component) => component.types?.includes(type))?.long_name || "";

const buildAddressFromComponents = (components) => {
  if (!components?.length) {
    return "";
  }
  const streetNumber = getComponent(components, "street_number");
  const route = getComponent(components, "route");
  const premise = getComponent(components, "premise");
  const subpremise = getComponent(components, "subpremise");
  const neighborhood =
    getComponent(components, "neighborhood") ||
    getComponent(components, "sublocality") ||
    getComponent(components, "sublocality_level_1");
  const postalCode = getComponent(components, "postal_code");

  const streetLine = [streetNumber, route].filter(Boolean).join(" ").trim();
  const parts = [];
  if (premise) {
    parts.push(premise);
  }
  if (subpremise && subpremise !== premise) {
    parts.push(subpremise);
  }
  if (streetLine) {
    parts.push(streetLine);
  } else if (route) {
    parts.push(route);
  }
  if (neighborhood) {
    parts.push(neighborhood);
  }
  if (postalCode) {
    parts.push(postalCode);
  }

  return parts.filter(Boolean).join(", ");
};

const getPostalFromComponents = (components) => getComponent(components, "postal_code");

const isGenericAddress = (address, postalCode) => {
  if (!address) {
    return true;
  }
  const normalized = address.trim().toLowerCase();
  if (normalized === "singapore") {
    return true;
  }
  if (postalCode) {
    const normalizedPostal = postalCode.trim().toLowerCase();
    if (normalized === `singapore ${normalizedPostal}`) {
      return true;
    }
  }
  return false;
};

const extractLatLng = (location) => {
  if (!location) {
    return null;
  }
  if (typeof location.lat === "function") {
    return { lat: location.lat(), lng: location.lng() };
  }
  if (typeof location.lat === "number") {
    return { lat: location.lat, lng: location.lng };
  }
  return null;
};

const scoreResult = (result, postalCode) => {
  const locationTypeWeights = {
    ROOFTOP: 30,
    RANGE_INTERPOLATED: 20,
    GEOMETRIC_CENTER: 10,
    APPROXIMATE: 0
  };
  const typeWeights = {
    street_address: 100,
    premise: 90,
    subpremise: 85,
    route: 80,
    establishment: 70,
    point_of_interest: 60,
    neighborhood: 50,
    sublocality: 45,
    sublocality_level_1: 45,
    postal_code: 10,
    locality: 5,
    country: 1
  };

  const components = result.address_components || [];
  const addressFromComponents = buildAddressFromComponents(components);
  const hasPremise = Boolean(getComponent(components, "premise"));
  const hasStreetNumber = Boolean(getComponent(components, "street_number"));
  const hasRoute = Boolean(getComponent(components, "route"));

  let score = 0;
  let bestTypeWeight = 0;
  (result.types || []).forEach((type) => {
    bestTypeWeight = Math.max(bestTypeWeight, typeWeights[type] || 0);
  });
  score += bestTypeWeight;
  score += locationTypeWeights[result.geometry?.location_type] || 0;
  if (hasPremise) score += 25;
  if (hasStreetNumber) score += 20;
  if (hasRoute) score += 20;
  if (isGenericAddress(result.formatted_address, postalCode)) score -= 40;

  return {
    score,
    address: addressFromComponents || result.formatted_address || "",
    location: extractLatLng(result.geometry?.location),
    postalCode: getPostalFromComponents(components)
  };
};

const pickBestAddress = (results, postalCode) => {
  if (!results?.length) {
    return { address: "", location: null };
  }
  let best = { score: -Infinity, address: "", location: null, postalCode: "" };
  results.forEach((result) => {
    const candidate = scoreResult(result, postalCode);
    if (candidate.score > best.score) {
      best = candidate;
    }
  });
  return {
    address: best.address || results[0].formatted_address || "",
    location: best.location,
    postalCode: best.postalCode || ""
  };
};

const reverseGeocode = (geocoder, location) =>
  new Promise((resolve) => {
    geocoder.geocode({ location }, (results, status) => {
      if (status !== "OK" || !results?.length) {
        resolve([]);
        return;
      }
      resolve(results);
    });
  });

const fetchGeocodeByPostal = async (postalCode) => {
  if (!GOOGLE_MAPS_API_KEY) {
    return [];
  }
  const params = new URLSearchParams({
    components: `country:SG|postal_code:${postalCode}`,
    key: GOOGLE_MAPS_API_KEY,
    region: "SG",
    result_type: "street_address|premise|subpremise|route|postal_code",
    location_type: "ROOFTOP|RANGE_INTERPOLATED"
  });
  const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    if (data.status !== "OK") {
      return [];
    }
    return data.results || [];
  } catch (error) {
    return [];
  }
};

export const geocodePostal = async (postalCode) => {
  assertMapsLoaded();
  const trimmed = postalCode.trim();

  const geocoder = new window.google.maps.Geocoder();
  const initialResults = await new Promise((resolve) => {
    geocoder.geocode(
      {
        address: trimmed,
        componentRestrictions: { country: "SG" },
        region: "SG"
      },
      (results, status) => {
        if (status !== "OK" || !results?.length) {
          resolve([]);
          return;
        }
        resolve(results);
      }
    );
  });

  if (!initialResults.length) {
    return null;
  }

  const location = initialResults[0].geometry.location;
  const latLng = extractLatLng(location);
  const isPostalOnly = /^\d{6}$/.test(trimmed);
  const candidates = [...initialResults];

  if (isPostalOnly) {
    const httpResults = await fetchGeocodeByPostal(trimmed);
    if (httpResults.length) {
      candidates.push(...httpResults);
    }
    const reverseResults = await reverseGeocode(geocoder, location);
    if (reverseResults.length) {
      candidates.push(...reverseResults);
    }
  }

  const best = pickBestAddress(candidates, trimmed);
  let address = best.address;
  const bestLocation = best.location || latLng;
  const looksGeneric = isGenericAddress(address, trimmed);
  const candidatePostals = candidates
    .map((result) => getPostalFromComponents(result.address_components))
    .filter(Boolean);
  const hasPostalCandidates = candidatePostals.length > 0;
  const postalMismatch = isPostalOnly && hasPostalCandidates && !candidatePostals.includes(trimmed);
  if (isPostalOnly && looksGeneric && !address) {
    address = `Singapore ${trimmed}`;
  }

  return {
    lat: bestLocation?.lat ?? latLng?.lat,
    lng: bestLocation?.lng ?? latLng?.lng,
    address,
    postalMismatch
  };
};

const requestDistanceMatrix = (service, origins, destinations) =>
  new Promise((resolve, reject) => {
    service.getDistanceMatrix(
      {
        origins,
        destinations,
        travelMode: window.google.maps.TravelMode.DRIVING,
        unitSystem: window.google.maps.UnitSystem.METRIC
      },
      (response, status) => {
        if (status !== "OK") {
          reject(new Error(status));
          return;
        }
        resolve(response);
      }
    );
  });

export const getDistanceMatrix = async (locations) => {
  assertMapsLoaded();

  if (!locations.length) {
    return { distanceMatrix: [], durationMatrix: [] };
  }

  const size = locations.length;
  const distanceMatrix = Array.from({ length: size }, () => Array(size).fill(null));
  const durationMatrix = Array.from({ length: size }, () => Array(size).fill(null));
  const maxElements = 100;
  const chunkSize = Math.max(1, Math.floor(maxElements / locations.length));
  const service = new window.google.maps.DistanceMatrixService();

  for (let start = 0; start < size; start += chunkSize) {
    const originChunk = locations.slice(start, start + chunkSize);
    const response = await requestDistanceMatrix(service, originChunk, locations);

    response.rows.forEach((row, rowIndex) => {
      row.elements.forEach((element, colIndex) => {
        if (element.status !== "OK") {
          distanceMatrix[start + rowIndex][colIndex] = null;
          durationMatrix[start + rowIndex][colIndex] = null;
        } else {
          distanceMatrix[start + rowIndex][colIndex] = element.distance.value;
          durationMatrix[start + rowIndex][colIndex] = element.duration.value;
        }
      });
    });
  }

  return { distanceMatrix, durationMatrix };
};
