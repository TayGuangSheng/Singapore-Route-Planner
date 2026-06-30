const getStopIndices = (distanceMatrix, endIndex = null) =>
  distanceMatrix
    .map((_, index) => index)
    .filter((index) => index !== 0 && index !== endIndex);

export const buildNearestNeighborOrder = (distanceMatrix, options = {}) => {
  const { endIndex = null } = options;
  const size = distanceMatrix.length;
  if (size <= 1) {
    return [];
  }

  const visited = new Array(size).fill(false);
  visited[0] = true;
  if (endIndex !== null) {
    visited[endIndex] = true;
  }
  const order = [];
  let current = 0;
  const stopIndices = getStopIndices(distanceMatrix, endIndex);

  for (let step = 0; step < stopIndices.length; step += 1) {
    let nearest = null;
    let bestDistance = Infinity;

    for (const next of stopIndices) {
      if (visited[next]) {
        continue;
      }
      const distance = distanceMatrix[current][next];
      if (typeof distance === "number" && distance < bestDistance) {
        bestDistance = distance;
        nearest = next;
      }
    }

    if (nearest === null) {
      break;
    }

    visited[nearest] = true;
    order.push(nearest);
    current = nearest;
  }

  return order;
};

const routeDistance = (order, distanceMatrix, endIndex = null) => {
  let total = 0;
  let current = 0;
  for (const next of order) {
    const distance = distanceMatrix[current][next];
    if (typeof distance !== "number") {
      return Infinity;
    }
    total += distance;
    current = next;
  }
  if (endIndex !== null) {
    const distance = distanceMatrix[current]?.[endIndex];
    if (typeof distance !== "number") {
      return Infinity;
    }
    total += distance;
  }
  return total;
};

export const applyTwoOpt = (order, distanceMatrix, options = {}) => {
  const { endIndex = null } = options;
  if (order.length < 2) {
    return order;
  }
  let bestOrder = order.slice();
  let bestDistance = routeDistance(bestOrder, distanceMatrix, endIndex);
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < bestOrder.length - 1; i += 1) {
      for (let k = i + 1; k < bestOrder.length; k += 1) {
        const newOrder = [
          ...bestOrder.slice(0, i),
          ...bestOrder.slice(i, k + 1).reverse(),
          ...bestOrder.slice(k + 1)
        ];
        const newDistance = routeDistance(newOrder, distanceMatrix, endIndex);
        if (newDistance < bestDistance) {
          bestOrder = newOrder;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }

  return bestOrder;
};

export const computeRouteTotal = (matrix, order, options = {}) => {
  const { endIndex = null } = options;
  let total = 0;
  let current = 0;
  for (const next of order) {
    const value = matrix[current][next];
    if (typeof value !== "number") {
      return 0;
    }
    total += value;
    current = next;
  }
  if (endIndex !== null) {
    const value = matrix[current]?.[endIndex];
    if (typeof value !== "number") {
      return 0;
    }
    total += value;
  }
  return total;
};
