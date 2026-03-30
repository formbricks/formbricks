/**
 * Utility functions for converting absolute storage URLs to relative paths
 */

// Regex to match absolute storage URLs: http(s)://anything/storage/...
const ABSOLUTE_STORAGE_URL_REGEX = /^https?:\/\/[^/]+\/storage\//;

/**
 * Convert an absolute storage URL to a relative path
 * @param url The URL to convert
 * @returns The relative path if it's an absolute storage URL, otherwise the original value
 */
export function convertStorageUrlToRelative(url: string): string {
  if (!url || typeof url !== "string") {
    return url;
  }

  // Check if it's an absolute storage URL
  if (ABSOLUTE_STORAGE_URL_REGEX.test(url)) {
    const storageIndex = url.indexOf("/storage/");
    if (storageIndex !== -1) {
      return url.substring(storageIndex); // Returns /storage/...
    }
  }

  return url; // Return unchanged if not an absolute storage URL
}

/**
 * Track statistics for URL conversions
 */
let urlConversionCount = 0;

export function resetUrlConversionCount(): void {
  urlConversionCount = 0;
}

export function getUrlConversionCount(): number {
  return urlConversionCount;
}

/**
 * Recursively transform all string values in an object, converting absolute storage URLs to relative paths
 * @param obj The object to transform
 * @returns The transformed object (mutated in place for arrays/objects)
 */
export function transformJsonUrls(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    const converted = convertStorageUrlToRelative(obj);
    if (converted !== obj) {
      urlConversionCount++;
    }
    return converted;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformJsonUrls(item));
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = transformJsonUrls(value);
    }
    return result;
  }

  return obj;
}

/**
 * Check if an object contains any absolute storage URLs
 * @param obj The object to check
 * @returns true if the object contains absolute storage URLs
 */
export function containsAbsoluteStorageUrl(obj: unknown): boolean {
  if (obj === null || obj === undefined) {
    return false;
  }

  if (typeof obj === "string") {
    return ABSOLUTE_STORAGE_URL_REGEX.test(obj);
  }

  if (Array.isArray(obj)) {
    return obj.some((item) => containsAbsoluteStorageUrl(item));
  }

  if (typeof obj === "object") {
    return Object.values(obj as Record<string, unknown>).some((value) => containsAbsoluteStorageUrl(value));
  }

  return false;
}
