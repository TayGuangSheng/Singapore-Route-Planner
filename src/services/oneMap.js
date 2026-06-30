const ONEMAP_SEARCH_URL = "https://www.onemap.gov.sg/api/common/elastic/search";
const ONEMAP_ROUTE_PROXY_URL = import.meta.env?.VITE_ONEMAP_ROUTE_PROXY_URL || "/api/onemap-route";
const FALLBACK_ROUTE_DISTANCE_FACTOR = 1.35;
const DEFAULT_AVERAGE_SPEED_KMH = 30;
const SEARCH_RETRY_DELAYS_MS = [350, 900, 1800];
const searchResultCache = new Map();
const pendingSearchRequests = new Map();
const KNOWN_POSTAL_LOCATIONS = {
  "079903": {
    lat: 1.27588674266836,
    lng: 103.845923793168,
    address: "10 Anson Road, International Plaza, Singapore 079903"
  },
  "238801": {
    lat: 1.30397974144505,
    lng: 103.832032328465,
    address: "2 Orchard Turn, ION Orchard, Singapore 238801"
  },
  "310145": {
    lat: 1.33521035428159,
    lng: 103.846162940767,
    address: "145 Lorong 2 Toa Payoh, Toa Payoh Towers, Singapore 310145"
  },
  "310144": {
    lat: 1.33535073315709,
    lng: 103.84402714867,
    address: "144 Lorong 2 Toa Payoh, Singapore 310144"
  },
  "325113": {
    lat: 1.32014859879822,
    lng: 103.859763746554,
    address: "113D Mcnair Road, Mcnair Towers, Singapore 325113"
  },
  "668690": {
    lat: 1.35863152457232,
    lng: 103.759922203036,
    address: "30 Jalan Remaja, Hillview Garden Estate, Singapore 668690"
  },
  "649517": {
    lat: 1.35103948153134,
    lng: 103.723669186664,
    address: "10 Jurong West Avenue 1, Esso Jurong West, Singapore 649517"
  },
  "737736": {
    lat: 1.43451360623152,
    lng: 103.788228951949,
    address: "11 Woodlands Square, Woodlands Ave 2 Pumping Station, Singapore 737736"
  },
  "569620": {
    lat: 1.35846637676677,
    lng: 103.855782563986,
    address: "440 Ang Mo Kio Industrial Park 1, Japan Medical Centre, Singapore 569620"
  },
  "819663": {
    lat: 1.35662609413487,
    lng: 103.986562208495,
    address: "65 Airport Boulevard, Changi Airport Terminal 3 Building, Singapore 819663"
  },
  "050335": {
    lat: 1.2822749605271,
    lng: 103.843238518071,
    address: "335 Smith Street, Chinatown Complex, Singapore 050335"
  }
};

const wait = (milliseconds) => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

const normalizePostalForComparison = (value) =>
  value === null || value === undefined ? "" : String(value).replace(/\s+/g, "").trim();

const isPostalOnly = (value) => /^\d{6}$/.test(value.trim());

const extractPostalFromText = (value) => value.match(/(^|\D)(\d{6})(?!\d)/)?.[2] || "";

const normalizeSearchQuery = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .trim();

const removeParentheticalText = (value) =>
  normalizeSearchQuery(value.replace(/\([^)]*\)/g, " ").replace(/\s*,\s*/g, ", "));

const dedupeValues = (values) => {
  const seen = new Set();
  return values
    .map(normalizeSearchQuery)
    .filter((value) => {
      const key = value.toLowerCase();
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
};

const getSearchQueries = (value) => {
  const trimmed = normalizeSearchQuery(value);
  const postal = extractPostalFromText(trimmed);
  if (!postal) {
    const withoutParentheses = removeParentheticalText(trimmed);
    const parts = withoutParentheses.split(",").map((part) => part.trim());
    return dedupeValues([trimmed, withoutParentheses, ...parts]);
  }

  const withoutSingaporePostal = trimmed
    .replace(new RegExp(`,?\\s*Singapore\\s+${postal}`, "i"), "")
    .trim();
  const withoutParentheses = removeParentheticalText(withoutSingaporePostal);
  const parts = withoutParentheses
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^singapore$/i.test(part) && part !== postal);
  const postalScopedParts = parts.map((part) => `${part} ${postal}`);

  return dedupeValues([
    postal,
    withoutSingaporePostal,
    withoutParentheses,
    ...postalScopedParts,
    ...parts,
    trimmed
  ]);
};

const getKnownLocation = (value) => {
  const trimmed = value.trim();
  const normalizedPostal = normalizePostalForComparison(extractPostalFromText(trimmed) || trimmed);
  if (KNOWN_POSTAL_LOCATIONS[normalizedPostal]) {
    return KNOWN_POSTAL_LOCATIONS[normalizedPostal];
  }

  const normalizedAddress = trimmed.toLowerCase();
  return (
    Object.values(KNOWN_POSTAL_LOCATIONS).find(
      (location) => location.address.toLowerCase() === normalizedAddress
    ) || null
  );
};

const toLatLngLiteral = (location) => {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
};

const toRadians = (value) => (value * Math.PI) / 180;

const getAverageSpeedMetersPerSecond = (averageSpeedKmh = DEFAULT_AVERAGE_SPEED_KMH) => {
  const speedKmh = Number(averageSpeedKmh);
  const safeSpeedKmh = Number.isFinite(speedKmh) && speedKmh > 0 ? speedKmh : DEFAULT_AVERAGE_SPEED_KMH;
  return (safeSpeedKmh * 1000) / 3600;
};

const getDurationFromDistance = (distanceMeters, averageSpeedKmh) =>
  Math.round(distanceMeters / getAverageSpeedMetersPerSecond(averageSpeedKmh));

const getFallbackDistanceMeters = (origin, destination) => {
  if (origin.lat === destination.lat && origin.lng === destination.lng) {
    return 0;
  }

  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(destination.lat - origin.lat);
  const deltaLng = toRadians(destination.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const destinationLat = toRadians(destination.lat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(originLat) * Math.cos(destinationLat) * Math.sin(deltaLng / 2) ** 2;
  const directDistance = 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(directDistance * FALLBACK_ROUTE_DISTANCE_FACTOR);
};

const buildFallbackDistanceMatrix = (locations, averageSpeedKmh) => {
  const size = locations.length;
  const distanceMatrix = Array.from({ length: size }, () => Array(size).fill(0));
  const durationMatrix = Array.from({ length: size }, () => Array(size).fill(0));

  locations.forEach((origin, rowIndex) => {
    locations.forEach((destination, colIndex) => {
      const distance = getFallbackDistanceMeters(origin, destination);
      distanceMatrix[rowIndex][colIndex] = distance;
      durationMatrix[rowIndex][colIndex] = getDurationFromDistance(distance, averageSpeedKmh);
    });
  });

  return { distanceMatrix, durationMatrix };
};

const buildOneMapAddress = (result) => {
  const block = result?.BLK_NO || "";
  const road = result?.ROAD_NAME || "";
  const building = result?.BUILDING && result.BUILDING !== "NIL" ? result.BUILDING : "";
  const postal = result?.POSTAL || "";
  const address = result?.ADDRESS || "";

  const parts = [];
  const streetLine = [block, road].filter(Boolean).join(" ").trim();
  if (streetLine) {
    parts.push(streetLine);
  }
  if (building && building.toLowerCase() !== streetLine.toLowerCase()) {
    parts.push(building);
  }
  if (postal) {
    parts.push(`Singapore ${postal}`);
  }

  return parts.join(", ") || address;
};

const fetchOneMapSearchUncached = async (query) => {
  const params = new URLSearchParams({
    searchVal: query,
    returnGeom: "Y",
    getAddrDetails: "Y",
    pageNum: "1"
  });
  const url = `${ONEMAP_SEARCH_URL}?${params.toString()}`;

  for (let attempt = 0; attempt <= SEARCH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data?.results) ? data.results : [];
      }

      const canRetry = response.status === 429 || response.status >= 500;
      if (!canRetry || attempt === SEARCH_RETRY_DELAYS_MS.length) {
        return null;
      }
    } catch (error) {
      if (attempt === SEARCH_RETRY_DELAYS_MS.length) {
        return null;
      }
    }

    await wait(SEARCH_RETRY_DELAYS_MS[attempt]);
  }

  return null;
};

const fetchOneMapSearch = async (query) => {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  const cacheKey = normalizedQuery.toLowerCase();
  if (searchResultCache.has(cacheKey)) {
    return searchResultCache.get(cacheKey);
  }
  if (pendingSearchRequests.has(cacheKey)) {
    return pendingSearchRequests.get(cacheKey);
  }

  const request = fetchOneMapSearchUncached(normalizedQuery).then((results) => {
    if (results) {
      searchResultCache.set(cacheKey, results);
      return results;
    }
    return [];
  });
  pendingSearchRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    pendingSearchRequests.delete(cacheKey);
  }
};

const buildSuggestionFromResult = (result) => {
  const latLng = getSearchResultLatLng(result);
  const address = buildOneMapAddress(result);
  if (!latLng || !address) {
    return null;
  }

  return {
    id: `${result?.POSTAL || ""}-${address}-${latLng.lat}-${latLng.lng}`,
    label: result?.SEARCHVAL || address,
    address,
    postal: result?.POSTAL || "",
    value: address,
    ...latLng
  };
};

const buildSuggestionFromKnownLocation = (postal, location) => ({
  id: `known-${postal}`,
  label: location.address,
  address: location.address,
  postal,
  value: location.address,
  lat: location.lat,
  lng: location.lng
});

const dedupeSuggestions = (suggestions) => {
  const seen = new Set();
  return suggestions.filter((suggestion) => {
    if (!suggestion) {
      return false;
    }
    const key = `${suggestion.postal}-${suggestion.address}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const dedupeSearchResults = (results) => {
  const seen = new Set();
  return results.filter((result) => {
    if (!result) {
      return false;
    }
    const key = `${result.POSTAL || ""}-${result.ADDRESS || ""}-${result.LATITUDE || ""}-${
      result.LONGITUDE || ""
    }`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const tokenizeSearchText = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 2);

const scoreSearchResult = (result, query) => {
  const haystack = [
    result?.ADDRESS,
    result?.SEARCHVAL,
    result?.BLK_NO,
    result?.ROAD_NAME,
    result?.BUILDING,
    result?.POSTAL
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tokens = tokenizeSearchText(query);
  const postal = extractPostalFromText(query);

  let score = 0;
  if (postal && normalizePostalForComparison(result?.POSTAL) === postal) {
    score += 100;
  }
  tokens.forEach((token) => {
    if (haystack.includes(token)) {
      score += token.length > 2 ? 8 : 4;
    }
  });
  if (result?.SEARCHVAL && query.toLowerCase().includes(String(result.SEARCHVAL).toLowerCase())) {
    score += 35;
  }
  if (result?.BUILDING && query.toLowerCase().includes(String(result.BUILDING).toLowerCase())) {
    score += 25;
  }

  return score;
};

const getSearchResultLatLng = (result) => {
  const lat = Number(result?.LATITUDE);
  const lng = Number(result?.LONGITUDE || result?.LONGTITUDE);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
};

const pickOneMapResult = (results, query) => {
  const viableResults = results.filter((result) => getSearchResultLatLng(result));
  if (!viableResults.length) {
    return null;
  }

  return viableResults
    .slice()
    .sort((a, b) => scoreSearchResult(b, query) - scoreSearchResult(a, query))[0];
};

const buildGeocodedLocation = (result, originalValue) => {
  const latLng = getSearchResultLatLng(result);
  if (!result || !latLng) {
    return null;
  }

  return {
    ...latLng,
    address: buildOneMapAddress(result),
    postalMismatch:
      isPostalOnly(originalValue) &&
      normalizePostalForComparison(result.POSTAL) !== normalizePostalForComparison(originalValue)
  };
};

export const geocodeLocation = async (value) => {
  const trimmed = normalizeSearchQuery(value);
  if (!trimmed) {
    return null;
  }
  const knownLocation = getKnownLocation(trimmed);
  const knownFallback = knownLocation
    ? { ...knownLocation, postalMismatch: false, isCached: true }
    : null;
  const requestedPostal = extractPostalFromText(trimmed);
  let bestFallback = knownFallback;

  for (const searchQuery of getSearchQueries(trimmed)) {
    const results = dedupeSearchResults(await fetchOneMapSearch(searchQuery));
    if (!results.length) {
      continue;
    }

    const postalMatchedResults = requestedPostal
      ? results.filter(
          (result) =>
            normalizePostalForComparison(result?.POSTAL) === normalizePostalForComparison(requestedPostal)
        )
      : [];
    const result = pickOneMapResult(
      postalMatchedResults.length ? postalMatchedResults : results,
      trimmed
    );
    const location = buildGeocodedLocation(result, trimmed);
    if (!location) {
      continue;
    }

    if (
      requestedPostal &&
      normalizePostalForComparison(result?.POSTAL) === normalizePostalForComparison(requestedPostal)
    ) {
      return { ...location, postalMismatch: false };
    }

    if (!bestFallback) {
      bestFallback = location;
    }

    if (!requestedPostal) {
      return location;
    }
  }

  return bestFallback;
};

export const searchLocations = async (query, limit = 6) => {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const normalizedQuery = trimmed.toLowerCase();
  const knownSuggestions = Object.entries(KNOWN_POSTAL_LOCATIONS)
    .filter(
      ([postal, location]) =>
        postal.startsWith(normalizePostalForComparison(trimmed)) ||
        location.address.toLowerCase().includes(normalizedQuery)
    )
    .map(([postal, location]) => buildSuggestionFromKnownLocation(postal, location));

  const resultSets = [];
  for (const searchQuery of getSearchQueries(trimmed)) {
    resultSets.push(await fetchOneMapSearch(searchQuery));
    if (dedupeSearchResults(resultSets.flat()).length >= limit) {
      break;
    }
  }
  const results = dedupeSearchResults(resultSets.flat());
  const apiSuggestions = results.map(buildSuggestionFromResult);

  return dedupeSuggestions([...knownSuggestions, ...apiSuggestions]).slice(0, limit);
};

export const getDistanceMatrix = (locations, options = {}) => {
  if (!locations.length) {
    return { distanceMatrix: [], durationMatrix: [], isApproximate: false };
  }

  const normalizedLocations = locations.map(toLatLngLiteral);
  if (normalizedLocations.some((location) => !location)) {
    throw new Error("INVALID_LOCATION");
  }

  return {
    ...buildFallbackDistanceMatrix(normalizedLocations, options.averageSpeedKmh),
    isApproximate: true
  };
};

const decodeRouteGeometry = (encoded) => {
  if (!encoded) {
    return [];
  }

  let index = 0;
  let lat = 0;
  let lng = 0;
  const path = [];

  while (index < encoded.length) {
    let byte = null;
    let shift = 0;
    let result = 0;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    path.push({ lat: lat / 100000, lng: lng / 100000 });
  }

  return path;
};

const getFallbackPathDetails = (points, averageSpeedKmh) => {
  let totalDistance = 0;
  const path = [];

  points.forEach((point, index) => {
    if (index > 0) {
      totalDistance += getFallbackDistanceMeters(points[index - 1], point);
    }
    path.push(point);
  });

  return {
    path,
    totalDistance,
    totalDuration: getDurationFromDistance(totalDistance, averageSpeedKmh),
    isApproximate: true
  };
};

const fetchDriveRouteLeg = async (origin, destination) => {
  const response = await fetch(ONEMAP_ROUTE_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ origin, destination })
  });

  if (!response.ok) {
    throw new Error(`ROUTING_${response.status}`);
  }
  return response.json();
};

export const getRouteDetails = async (origin, orderedStops, endLocation, options = {}) => {
  const points = [origin, ...orderedStops.map((stop) => stop.latLng), endLocation]
    .filter(Boolean)
    .map(toLatLngLiteral);

  if (points.length < 2 || points.some((point) => !point)) {
    return getFallbackPathDetails(points.filter(Boolean), options.averageSpeedKmh);
  }

  try {
    let totalDistance = 0;
    let totalDuration = 0;
    const path = [];

    for (let index = 0; index < points.length - 1; index += 1) {
      const data = await fetchDriveRouteLeg(points[index], points[index + 1]);
      const summary = data?.route_summary || {};
      totalDistance += Number(summary.total_distance) || 0;
      totalDuration += Number(summary.total_time) || 0;

      const decodedPath = decodeRouteGeometry(data?.route_geometry);
      if (decodedPath.length) {
        path.push(...(path.length ? decodedPath.slice(1) : decodedPath));
      } else {
        path.push(points[index], points[index + 1]);
      }
    }

    return {
      path,
      totalDistance,
      totalDuration: getDurationFromDistance(totalDistance, options.averageSpeedKmh) || totalDuration,
      isApproximate: false
    };
  } catch (error) {
    return getFallbackPathDetails(points, options.averageSpeedKmh);
  }
};
