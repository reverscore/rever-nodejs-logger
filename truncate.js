const DEFAULT_MAX_LOG_SIZE_BYTES = 200 * 1024;
const MIN_MAX_LOG_SIZE_BYTES = 256;
const MAX_STRING_LENGTH = 2048;
const MAX_ARRAY_LENGTH = 10;
const MAX_PASSES = 3;
const PREVIEW_LENGTH = 2048;

const byteSize = (value) => Buffer.byteLength(JSON.stringify(value) ?? '');

const truncateString = (value, max) => `${value.slice(0, max)}…[truncated ${value.length - max} chars]`;

const deepTruncate = (value, maxString, maxArray) => {
  if (typeof value === 'string') {
    return value.length > maxString ? truncateString(value, maxString) : value;
  }
  if (Array.isArray(value)) {
    if (value.length > maxArray) {
      const retained = value.slice(0, maxArray).map((item) => deepTruncate(item, maxString, maxArray));
      return retained.concat([{ __truncated: true, originalLength: value.length }]);
    }
    return value.map((item) => deepTruncate(item, maxString, maxArray));
  }
  if (value instanceof Date) return value;
  if (value instanceof Map || value instanceof Set) return value;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepTruncate(item, maxString, maxArray)]),
    );
  }
  return value;
};

const collapse = (originalJson, budget) => {
  const originalSize = Buffer.byteLength(originalJson ?? '');
  const result = { __truncated: true, originalSize, preview: '' };
  const overhead = Buffer.byteLength(JSON.stringify(result));
  const maxPreviewBytes = Math.max(0, budget - overhead);
  const text = String(originalJson ?? '');
  const ratio = originalSize > 0 ? text.length / originalSize : 1;
  result.preview = text.slice(0, Math.min(PREVIEW_LENGTH, Math.floor(maxPreviewBytes * ratio)));
  while (Buffer.byteLength(JSON.stringify(result)) > budget && result.preview.length > 0) {
    result.preview = result.preview.slice(0, -1);
  }
  return result;
};

const applyBudget = (metadata, budget = DEFAULT_MAX_LOG_SIZE_BYTES) => {
  try {
    const originalJson = JSON.stringify(metadata);
    const originalSize = Buffer.byteLength(originalJson ?? '');
    if (originalSize <= budget) return { metadata, truncated: false };

    let current = deepTruncate(metadata, MAX_STRING_LENGTH, MAX_ARRAY_LENGTH);
    let maxString = MAX_STRING_LENGTH;
    let maxArray = MAX_ARRAY_LENGTH;

    for (let pass = 0; pass < MAX_PASSES && byteSize(current) > budget; pass += 1) {
      maxString = Math.floor(maxString / 2);
      maxArray = Math.max(1, Math.floor(maxArray / 2));
      current = deepTruncate(metadata, maxString, maxArray);
    }

    if (byteSize(current) > budget) {
      return { metadata: { ...collapse(originalJson, budget), __truncated: true }, truncated: true };
    }

    if (JSON.stringify(current) !== originalJson) {
      return { metadata: { ...current, __truncated: true }, truncated: true };
    }

    return { metadata, truncated: false };
  } catch (err) {
    return { metadata: { __truncated: true, error: `truncation failed: ${err.message}` }, truncated: true };
  }
};

module.exports = { applyBudget, DEFAULT_MAX_LOG_SIZE_BYTES, MIN_MAX_LOG_SIZE_BYTES };
