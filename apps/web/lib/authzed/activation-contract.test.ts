import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAuthzedClientConfigDigest } from "./activation-contract";

const envMock = vi.hoisted(() => ({
  AUTHZED_CONSISTENCY: "fully_consistent" as "minimize_latency" | "fully_consistent" | undefined,
  AUTHZED_ENABLED: "true" as "true" | "false" | "1" | "0" | undefined,
  AUTHZED_ENDPOINT: "spicedb:50051" as string | undefined,
  AUTHZED_INSECURE: "true" as "true" | "false" | "1" | "0" | undefined,
  AUTHZED_SYSTEM_KEY: "formbricks" as string | undefined,
  AUTHZED_TOKEN: "initial-token" as string | undefined,
}));

vi.mock("node:crypto", async (importOriginal) => importOriginal());
vi.mock("@/lib/env", () => ({ env: envMock }));

describe("AuthZed activation contract", () => {
  beforeEach(() => {
    envMock.AUTHZED_CONSISTENCY = "fully_consistent";
    envMock.AUTHZED_ENABLED = "true";
    envMock.AUTHZED_ENDPOINT = "spicedb:50051";
    envMock.AUTHZED_INSECURE = "true";
    envMock.AUTHZED_SYSTEM_KEY = "formbricks";
    envMock.AUTHZED_TOKEN = "initial-token";
  });

  test("binds receipts to the normalized enabled state", () => {
    const enabledDigest = getAuthzedClientConfigDigest();

    envMock.AUTHZED_ENABLED = "false";

    expect(getAuthzedClientConfigDigest()).not.toBe(enabledDigest);
  });

  test("does not invalidate receipts when the client token rotates", () => {
    const initialDigest = getAuthzedClientConfigDigest();

    envMock.AUTHZED_TOKEN = "rotated-token";

    expect(getAuthzedClientConfigDigest()).toBe(initialDigest);
  });

  test.each([
    ["endpoint", () => (envMock.AUTHZED_ENDPOINT = "replacement-spicedb:50051")],
    ["system namespace", () => (envMock.AUTHZED_SYSTEM_KEY = "replacement")],
  ])("invalidates receipts when the %s changes", (_label, mutateConfiguration) => {
    const initialDigest = getAuthzedClientConfigDigest();

    mutateConfiguration();

    expect(getAuthzedClientConfigDigest()).not.toBe(initialDigest);
  });

  test("does not invalidate receipts for in-place TLS rotation", () => {
    const initialDigest = getAuthzedClientConfigDigest();

    envMock.AUTHZED_INSECURE = "false";

    expect(getAuthzedClientConfigDigest()).toBe(initialDigest);
  });

  test("normalizes equivalent enabled Boolean values", () => {
    const initialDigest = getAuthzedClientConfigDigest();

    envMock.AUTHZED_ENABLED = "1";

    expect(getAuthzedClientConfigDigest()).toBe(initialDigest);
  });

  test("invalidates receipts when fully consistent authorization is disabled", () => {
    const initialDigest = getAuthzedClientConfigDigest();

    envMock.AUTHZED_CONSISTENCY = "minimize_latency";

    expect(getAuthzedClientConfigDigest()).not.toBe(initialDigest);
  });
});
