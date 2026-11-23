import { describe, expect, test } from "vitest";
import { formatCallerIp } from "@/modules/ee/workflows/lib/caller-ip";

describe("formatCallerIp", () => {
  test("shows an IPv4 address as stored", () => {
    expect(formatCallerIp("203.0.113.7")).toEqual({ kind: "address", text: "203.0.113.7" });
  });

  test("compresses the stored /64 IPv6 network and marks it as a /64", () => {
    expect(formatCallerIp("2001:0db8:0001:0002:0000:0000:0000:0000")).toEqual({
      kind: "address",
      text: "2001:db8:1:2::/64",
    });
  });

  test("keeps zero groups inside the prefix when a longer zero run follows", () => {
    expect(formatCallerIp("2001:0db8:0000:0002:0000:0000:0000:0000")).toEqual({
      kind: "address",
      text: "2001:db8:0:2::/64",
    });
  });

  test("compresses an IPv6 value that is already short", () => {
    expect(formatCallerIp("2001:db8:1:2::")).toEqual({ kind: "address", text: "2001:db8:1:2::/64" });
  });

  test("reports the all-zeros network (a local caller) as unknown", () => {
    expect(formatCallerIp("0000:0000:0000:0000:0000:0000:0000:0000")).toEqual({ kind: "unknown" });
    expect(formatCallerIp("::")).toEqual({ kind: "unknown" });
    expect(formatCallerIp("0.0.0.0")).toEqual({ kind: "unknown" });
  });

  test("reports a missing IP as unknown", () => {
    expect(formatCallerIp(null)).toEqual({ kind: "unknown" });
    expect(formatCallerIp(undefined)).toEqual({ kind: "unknown" });
    expect(formatCallerIp("")).toEqual({ kind: "unknown" });
  });

  test("shows anything it cannot parse unchanged rather than guessing", () => {
    expect(formatCallerIp("not-an-ip")).toEqual({ kind: "address", text: "not-an-ip" });
  });
});
