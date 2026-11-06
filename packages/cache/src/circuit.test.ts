import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  beginCacheProbe,
  isCacheCircuitOpen,
  recordCacheFailure,
  recordCacheSuccess,
  resetCacheCircuit,
} from "./circuit";

beforeEach(() => {
  resetCacheCircuit();
  vi.restoreAllMocks();
});

describe("cache circuit", () => {
  test("rejects attempts during cooldown and permits only one probe", () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    vi.spyOn(Math, "random").mockReturnValue(0);

    recordCacheFailure();
    expect(isCacheCircuitOpen()).toBe(true);
    expect(beginCacheProbe()).toBe(false);

    clock.mockReturnValue(now + 1000);
    expect(beginCacheProbe()).toBe(true);
    expect(beginCacheProbe()).toBe(false);

    recordCacheSuccess();
    expect(isCacheCircuitOpen()).toBe(false);
    expect(beginCacheProbe()).toBe(true);
  });

  test("backs off after a failed probe", () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    vi.spyOn(Math, "random").mockReturnValue(0);

    recordCacheFailure();
    clock.mockReturnValue(now + 1000);
    expect(beginCacheProbe()).toBe(true);
    recordCacheFailure();

    clock.mockReturnValue(now + 2999);
    expect(beginCacheProbe()).toBe(false);
    clock.mockReturnValue(now + 3000);
    expect(beginCacheProbe()).toBe(true);
  });
});
