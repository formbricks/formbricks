import { beforeEach, describe, expect, test, vi } from "vitest";
import { computePlainEmailHash } from "./identity";

const mocks = vi.hoisted(() => ({
  env: { PLAIN_CHAT_HMAC_SECRET: undefined as string | undefined },
}));

vi.mock("@/lib/env", () => ({ env: mocks.env }));

describe("computePlainEmailHash", () => {
  beforeEach(() => {
    mocks.env.PLAIN_CHAT_HMAC_SECRET = undefined;
  });

  test("returns null when no secret is configured", () => {
    expect(computePlainEmailHash("john@example.com")).toBeNull();
  });

  test("computes the HMAC-SHA256 hex of the email with the secret", () => {
    mocks.env.PLAIN_CHAT_HMAC_SECRET = "test-secret";
    expect(computePlainEmailHash("john@example.com")).toBe(
      "831412b17524e7d41b2f9085360840f35558068db4efe31cebb6375fbd1ac0a8"
    );
  });

  test("is deterministic and email-specific", () => {
    mocks.env.PLAIN_CHAT_HMAC_SECRET = "test-secret";
    expect(computePlainEmailHash("a@example.com")).toBe(computePlainEmailHash("a@example.com"));
    expect(computePlainEmailHash("a@example.com")).not.toBe(computePlainEmailHash("b@example.com"));
  });
});
