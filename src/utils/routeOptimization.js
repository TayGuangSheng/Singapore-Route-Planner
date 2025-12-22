export const buildNearestNeighborOrder = (distanceMatrix) => {
  const size = distanceMatrix.length;
  if (size <= 1) {
    return [];
  }

  const visited = new Array(size).fill(false);
  visited[0] = true;
  const order = [];
  let current = 0;

  for (let step = 1; step < size; step += 1) {
    let nearest = null;
    let bestDistance = Infinity;

    for (let next = 1; next < size; next += 1) {
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

const routeDistance = (order, distanceMatrix) => {
  if (!order.length) {
    return 0;
  }
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
  return total;
};

export const applyTwoOpt = (order, distanceMatrix) => {
  if (order.length < 4) {
    return order;
  }
  let bestOrder = order.slice();
  let bestDistance = routeDistance(bestOrder, distanceMatrix);
  let improved = true;

  while (improved) {
    improved = false;
    for (let i = 0; i < bestOrder.length - 2; i += 1) {
      for (let k = i + 1; k < bestOrder.length - 1; k += 1) {
        const newOrder = [
          ...bestOrder.slice(0, i),
          ...bestOrder.slice(i, k + 1).reverse(),
          ...bestOrder.slice(k + 1)
        ];
        const newDistance = routeDistance(newOrder, distanceMatrix);
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

export const computeRouteTotal = (matrix, order) => {
  if (!order.length) {
    return 0;
  }
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
  return total;
};
