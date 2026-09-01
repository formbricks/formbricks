import { beforeEach, describe, expect, test, vi } from "vitest";
import { isAuthzedEnabled } from "./config";

const envMock = vi.hoisted(() => ({
  AUTHZED_CONSISTENCY: undefined as "minimize_latency" | "fully_consistent" | undefined,
  AUTHZED_ENABLED: undefined as "true" | "false" | "1" | "0" | undefined,
  AUTHZED_ENDPOINT: undefined as string | undefined,
  AUTHZED_INSECURE: undefined as "true" | "false" | "1" | "0" | undefined,
  AUTHZED_SYSTEM_KEY: undefined as string | undefined,
  AUTHZED_TOKEN: undefined as string | undefined,
}));

vi.mock("@/lib/env", () => ({ env: envMock }));

describe("AuthZed configuration", () => {
  beforeEach(() => {
    envMock.AUTHZED_CONSISTENCY = undefined;
    envMock.AUTHZED_ENABLED = undefined;
    envMock.AUTHZED_ENDPOINT = undefined;
    envMock.AUTHZED_INSECURE = undefined;
    envMock.AUTHZED_SYSTEM_KEY = undefined;
    envMock.AUTHZED_TOKEN = undefined;
  });

  test.each([
    [undefined, false],
    ["false", false],
    ["0", false],
    ["true", true],
    ["1", true],
  ] as const)("normalizes enabled value %s", (value, expected) => {
    envMock.AUTHZED_ENABLED = value;

    expect(isAuthzedEnabled()).toBe(expected);
  });
});
