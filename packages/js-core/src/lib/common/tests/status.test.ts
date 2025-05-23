import { checkSetup, getIsSetup, setIsSetup } from "@/lib/common/status";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("checkSetup()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIsSetup(false);
  });

  test("returns err if not setup", () => {
    const res = checkSetup();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("not_setup");
    }
  });

  test("returns ok if setup", () => {
    setIsSetup(true);
    const res = checkSetup();
    expect(res.ok).toBe(true);
  });
});

describe("getIsSetup()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIsSetup(false);
  });

  test("returns false if not setup", () => {
    const res = getIsSetup();
    expect(res).toBe(false);
  });

  test("returns true if setup", () => {
    setIsSetup(true);
    const res = getIsSetup();
    expect(res).toBe(true);
  });
});
