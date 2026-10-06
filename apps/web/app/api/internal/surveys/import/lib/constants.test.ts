import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  QSF_IMPORT_BODY_LIMIT_BYTES,
  QSF_IMPORT_DEADLINE_MS,
  QSF_IMPORT_HEARTBEAT_MS,
  QSF_IMPORT_MAX_IN_FLIGHT,
  QSF_IMPORT_MAX_IN_FLIGHT_PER_USER,
  QSF_IMPORT_RETRY_AFTER_SECONDS,
} from "./constants";

/** Next's `proxyClientMaxBodySize` from `next.config.mjs`, in bytes (Next counts `mb` as 1024²). */
const readProxyClientMaxBodySize = (): number => {
  const config = readFileSync(path.resolve(__dirname, "../../../../../../next.config.mjs"), "utf8");
  const match = /proxyClientMaxBodySize:\s*["'](\d+)(b|kb|mb|gb)["']/i.exec(config);
  if (!match) throw new Error("proxyClientMaxBodySize not found in next.config.mjs");

  const units: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Number(match[1]) * units[match[2].toLowerCase()];
};

describe("QSF import limits", () => {
  test("the body limit stays below Next's proxy buffer, so an oversized upload gets a 413", () => {
    // Next truncates a body over proxyClientMaxBodySize instead of rejecting it: at or above it, the
    // route would see cut-off JSON and answer 400.
    expect(QSF_IMPORT_BODY_LIMIT_BYTES).toBeLessThan(readProxyClientMaxBodySize());
    expect(Number.isSafeInteger(QSF_IMPORT_BODY_LIMIT_BYTES)).toBe(true);
  });

  test("the heartbeat keeps the stream well inside a 60 s proxy read timeout", () => {
    expect(QSF_IMPORT_HEARTBEAT_MS).toBeLessThanOrEqual(15_000);
  });

  test("the deadline leaves room for one AI call and its retry", () => {
    expect(QSF_IMPORT_DEADLINE_MS).toBeGreaterThanOrEqual(2 * 45_000);
  });

  test("the concurrency limit and Retry-After are usable values", () => {
    expect(QSF_IMPORT_MAX_IN_FLIGHT).toBeGreaterThanOrEqual(2);
    expect(QSF_IMPORT_MAX_IN_FLIGHT).toBeLessThanOrEqual(4);
    expect(QSF_IMPORT_RETRY_AFTER_SECONDS).toBeGreaterThan(0);
    // One user must never be able to take every slot on a pod.
    expect(QSF_IMPORT_MAX_IN_FLIGHT_PER_USER).toBeLessThan(QSF_IMPORT_MAX_IN_FLIGHT);
  });
});
