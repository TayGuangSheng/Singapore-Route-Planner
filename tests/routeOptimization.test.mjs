import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyTwoOpt,
  buildNearestNeighborOrder,
  computeRouteTotal
} from '../src/utils/routeOptimization.js';

test('route optimization excludes fixed end location from stop order', () => {
  const matrix = [
    [0, 1, 2, 99],
    [1, 0, 20, 100],
    [2, 20, 0, 1],
    [99, 100, 1, 0]
  ];

  const order = buildNearestNeighborOrder(matrix, { endIndex: 3 });

  assert.deepEqual(order, [1, 2]);
  assert(!order.includes(3));
});

test('two-opt considers the final end leg when improving short routes', () => {
  const matrix = [
    [0, 1, 2, 99],
    [1, 0, 1, 1],
    [2, 1, 0, 100],
    [99, 1, 100, 0]
  ];

  const nearest = buildNearestNeighborOrder(matrix, { endIndex: 3 });
  const optimized = applyTwoOpt(nearest, matrix, { endIndex: 3 });

  assert.deepEqual(nearest, [1, 2]);
  assert.deepEqual(optimized, [2, 1]);
  assert.equal(computeRouteTotal(matrix, optimized, { endIndex: 3 }), 4);
});
