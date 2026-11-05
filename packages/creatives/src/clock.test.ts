import { describe, expect, test } from "vitest";
import { getClockOffset } from "./clock";

const SERVER_TIME = "2026-10-20T02:00:00.000Z";
const server = Date.parse(SERVER_TIME);
const MINUTE = 60_000;

describe("getClockOffset", () => {
  test("trusts a device clock within about two minutes of the server", () => {
    expect(getClockOffset(SERVER_TIME, server)).toBe(0);
    expect(getClockOffset(SERVER_TIME, server - 2 * MINUTE)).toBe(0);
    expect(getClockOffset(SERVER_TIME, server + 2 * MINUTE)).toBe(0);
  });

  test("corrects a device clock running more than two minutes behind", () => {
    expect(getClockOffset(SERVER_TIME, server - 10 * MINUTE)).toBe(10 * MINUTE);
  });

  test("puts a device clock that looks a few minutes ahead down to a cached payload, not to skew", () => {
    // The payload can be up to ~3 minutes old (CDN 60 s + stale-while-revalidate 60 s + browser 60 s),
    // which makes a correct clock look ahead of `serverTime` by as much.
    expect(getClockOffset(SERVER_TIME, server + 4 * MINUTE)).toBe(0);
  });

  test("corrects a device clock running far ahead", () => {
    expect(getClockOffset(SERVER_TIME, server + 30 * MINUTE)).toBe(-30 * MINUTE);
  });

  test("trusts the device clock when the payload carries no usable server time", () => {
    expect(getClockOffset(undefined, server)).toBe(0);
    expect(getClockOffset("not a date", server)).toBe(0);
  });
});
