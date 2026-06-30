import assert from 'node:assert/strict';
import test from 'node:test';
import { geocodeLocation, getRouteDetails } from '../src/services/oneMap.js';

const makeSearchResult = ({ postal, address, lat, lng, searchVal = address }) => ({
  SEARCHVAL: searchVal,
  ADDRESS: address,
  BLK_NO: address.split(' ')[0],
  ROAD_NAME: address.split(',')[0].replace(address.split(' ')[0], '').trim(),
  BUILDING: address.split(',')[1]?.trim() || 'NIL',
  POSTAL: postal,
  LATITUDE: String(lat),
  LONGITUDE: String(lng)
});

const makeJsonResponse = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const withMockFetch = async (handler, run) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test('geocodeLocation resolves pasted Singapore addresses by postal code first', async () => {
  const fixtures = {
    '637034': makeSearchResult({
      postal: '637034',
      address: '94 NANYANG CRESCENT, NANYANG TECHNOLOGICAL UNIVERSITY, Singapore 637034',
      lat: 1.352949370203277,
      lng: 103.6892235086704
    }),
    '119081': makeSearchResult({
      postal: '119081',
      address: '25 LOWER KENT RIDGE ROAD, NUS (RIDGE VIEW RESIDENTIAL COLLEGE (RVRC)), Singapore 119081',
      lat: 1.29795051423399,
      lng: 103.7759508147812
    }),
    '348884': makeSearchResult({
      postal: '348884',
      address: '10 KWONG AVENUE, SIT INTERNATIONAL HOSTEL, Singapore 348884',
      lat: 1.330853736765987,
      lng: 103.8723370307179
    })
  };
  const requestedQueries = [];

  await withMockFetch(
    async (url, options) => {
      assert.equal(options, undefined);
      const query = new URL(url).searchParams.get('searchVal');
      requestedQueries.push(query);
      const result = fixtures[query];
      return makeJsonResponse({ found: result ? 1 : 0, results: result ? [result] : [] });
    },
    async () => {
      for (const [postal, result] of Object.entries(fixtures)) {
        const location = await geocodeLocation(result.ADDRESS);
        assert.equal(location.address, result.ADDRESS);
        assert.equal(location.postalMismatch, false);
        assert.equal(String(location.lat), result.LATITUDE);
        assert.equal(String(location.lng), result.LONGITUDE);
        assert(requestedQueries.includes(postal));
      }
    }
  );
});

test('getRouteDetails calls the local route proxy instead of OneMap directly', async () => {
  const calls = [];

  await withMockFetch(
    async (url, options) => {
      calls.push({ url, options });
      assert.equal(url, '/api/onemap-route');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(options.body), {
        origin: { lat: 1.3, lng: 103.8 },
        destination: { lat: 1.31, lng: 103.81 }
      });
      return makeJsonResponse({
        route_summary: {
          total_distance: 1800,
          total_time: 360
        },
        route_geometry: ''
      });
    },
    async () => {
      const details = await getRouteDetails(
        { lat: 1.3, lng: 103.8 },
        [],
        { lat: 1.31, lng: 103.81 },
        { averageSpeedKmh: 30 }
      );
      assert.equal(calls.length, 1);
      assert.equal(details.totalDistance, 1800);
      assert.equal(details.isApproximate, false);
    }
  );
});
