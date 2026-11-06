import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { AI_DEFAULT_TIMEOUT_MS } from "@formbricks/types/ai-timeout";
import {
  SURVEY_IMPORT_DEADLINE_MS,
  SURVEY_IMPORT_MAX_BODY_BYTES,
  SURVEY_IMPORT_MAX_FILE_BYTES,
  SURVEY_IMPORT_MAX_IN_FLIGHT,
  SURVEY_IMPORT_MAX_IN_FLIGHT_PER_USER,
  SURVEY_IMPORT_RETRY_AFTER_SECONDS,
} from "./limits";

/** Next's `proxyClientMaxBodySize` from `next.config.mjs`, in bytes (Next counts `mb` as 1024²). */
const readProxyClientMaxBodySize = (): number => {
  const config = readFileSync(path.resolve(__dirname, "../../../next.config.mjs"), "utf8");
  const match = /proxyClientMaxBodySize:\s*["'](\d+)(b|kb|mb|gb)["']/i.exec(config);
  if (!match) throw new Error("proxyClientMaxBodySize not found in next.config.mjs");

  const units: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Number(match[1]) * units[match[2].toLowerCase()];
};

describe("survey import limits", () => {
  test("the body limit stays below Next's proxy buffer, so an oversized upload gets a 413", () => {
    // Next truncates a body over proxyClientMaxBodySize instead of rejecting it: at or above it, the
    // route would see a cut-off body and answer 400.
    expect(SURVEY_IMPORT_MAX_BODY_BYTES).toBeLessThan(readProxyClientMaxBodySize());
    expect(Number.isSafeInteger(SURVEY_IMPORT_MAX_BODY_BYTES)).toBe(true);
  });

  test("a file the dialog accepts always fits the body limit, envelope included", () => {
    expect(SURVEY_IMPORT_MAX_FILE_BYTES).toBeLessThan(SURVEY_IMPORT_MAX_BODY_BYTES);
  });

  test("the deadline leaves room for one AI call and its retry", () => {
    expect(SURVEY_IMPORT_DEADLINE_MS).toBeGreaterThanOrEqual(2 * AI_DEFAULT_TIMEOUT_MS);
  });

  test("the concurrency limit and Retry-After are usable values", () => {
    expect(SURVEY_IMPORT_MAX_IN_FLIGHT).toBeGreaterThanOrEqual(2);
    expect(SURVEY_IMPORT_MAX_IN_FLIGHT).toBeLessThanOrEqual(4);
    expect(SURVEY_IMPORT_RETRY_AFTER_SECONDS).toBeGreaterThan(0);
    // One user must never be able to take every slot on a pod.
    expect(SURVEY_IMPORT_MAX_IN_FLIGHT_PER_USER).toBeLessThan(SURVEY_IMPORT_MAX_IN_FLIGHT);
  });
});
