import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ONEMAP_ROUTE_URL = 'https://www.onemap.gov.sg/api/public/routingsvc/route';

const parseEnvFile = () => {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return {};
  }

  return readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((entries, line) => {
      const match = line.match(/^\s*([^#=\s]+)\s*=(.*)$/);
      if (!match) {
        return entries;
      }
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
      entries[match[1]] = value;
      return entries;
    }, {});
};

const getOneMapToken = () => {
  const envFile = parseEnvFile();
  return (
    process.env.ONEMAP_API_TOKEN ||
    process.env.VITE_ONEMAP_API_TOKEN ||
    envFile.ONEMAP_API_TOKEN ||
    envFile.VITE_ONEMAP_API_TOKEN ||
    ''
  );
};

const isValidPoint = (point) =>
  point &&
  Number.isFinite(Number(point.lat)) &&
  Number.isFinite(Number(point.lng));

const readRequestBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 32_000) {
        reject(new Error('REQUEST_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

export const fetchOneMapDriveRoute = async ({ origin, destination, token = getOneMapToken() }) => {
  if (!token) {
    const error = new Error('ONEMAP_TOKEN_MISSING');
    error.statusCode = 503;
    throw error;
  }

  if (!isValidPoint(origin) || !isValidPoint(destination)) {
    const error = new Error('INVALID_ROUTE_POINTS');
    error.statusCode = 400;
    throw error;
  }

  const params = new URLSearchParams({
    start: `${Number(origin.lat)},${Number(origin.lng)}`,
    end: `${Number(destination.lat)},${Number(destination.lng)}`,
    routeType: 'drive'
  });

  const response = await fetch(`${ONEMAP_ROUTE_URL}?${params.toString()}`, {
    headers: { Authorization: token }
  });

  if (!response.ok) {
    const error = new Error(`ONEMAP_ROUTING_${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  return response.json();
};

export const handleOneMapRouteRequest = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const body = JSON.parse((await readRequestBody(req)) || '{}');
    const data = await fetchOneMapDriveRoute({
      origin: body.origin,
      destination: body.destination
    });
    sendJson(res, 200, data);
  } catch (error) {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    sendJson(res, statusCode, { error: error.message || 'ONEMAP_ROUTE_PROXY_FAILED' });
  }
};
