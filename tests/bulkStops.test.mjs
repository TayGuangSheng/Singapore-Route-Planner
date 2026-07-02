import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBulkStops } from '../src/utils/bulkStops.js';

test('parseBulkStops extracts postal codes across mixed separators', () => {
  assert.deepEqual(
    parseBulkStops('560123\n238879, 408600; S339348 | #569620 / stop: 819663'),
    ['560123', '238879', '408600', '339348', '569620', '819663']
  );
});

test('parseBulkStops prefers postal codes from pasted address lines', () => {
  assert.deepEqual(
    parseBulkStops(`10 Anson Road, Singapore 079903
2 Orchard Turn, Singapore 238801`),
    ['079903', '238801']
  );
});

test('parseBulkStops falls back to separated text when no postal codes are present', () => {
  assert.deepEqual(parseBulkStops('Depot A\nDepot B; Depot C | Depot D'), [
    'Depot A',
    'Depot B',
    'Depot C',
    'Depot D'
  ]);
});
