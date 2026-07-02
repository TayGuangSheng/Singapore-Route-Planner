const POSTAL_CODE_PATTERN = /(^|[^\d])(\d{6})(?!\d)/g;
const FALLBACK_SEPARATOR_PATTERN = /[\r\n,;|\t]+/;

const normalizeBulkStopValue = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const parseBulkStops = (value) => {
  const text = String(value || "");
  const postalCodes = [];

  for (const match of text.matchAll(POSTAL_CODE_PATTERN)) {
    postalCodes.push(match[2]);
  }

  if (postalCodes.length) {
    return postalCodes;
  }

  return text
    .split(FALLBACK_SEPARATOR_PATTERN)
    .map(normalizeBulkStopValue)
    .filter(Boolean);
};
