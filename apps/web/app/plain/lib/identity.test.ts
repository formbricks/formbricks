import { beforeEach, describe, expect, test, vi } from "vitest";
import { computePlainCustomerDetailsSignature } from "./identity";

const mocks = vi.hoisted(() => ({
  env: { PLAIN_CHAT_HMAC_SECRET: undefined as string | undefined },
}));

vi.mock("@/lib/env", () => ({ env: mocks.env }));

// Test vectors from https://www.plain.com/docs/product/channels/chat-authentication
describe("computePlainCustomerDetailsSignature", () => {
  beforeEach(() => {
    mocks.env.PLAIN_CHAT_HMAC_SECRET = undefined;
  });

  test("returns null when no secret is configured", () => {
    expect(
      computePlainCustomerDetailsSignature({ email: "ada@example.com", externalId: "user_123" })
    ).toBeNull();
  });

  test("signs the raw email when there is no external ID", () => {
    mocks.env.PLAIN_CHAT_HMAC_SECRET = "chat_secret_example";
    expect(computePlainCustomerDetailsSignature({ email: "ada@example.com" })).toBe(
      "ad990bba2bd71e79e79c042c6291344ae152fa267d6c15446b2e97b2892834df"
    );
  });

  test("signs the email and external ID together", () => {
    mocks.env.PLAIN_CHAT_HMAC_SECRET = "chat_secret_example";
    expect(computePlainCustomerDetailsSignature({ email: "ada@example.com", externalId: "user_123" })).toBe(
      "07c1924d9865df9b1cefceedebd61dfd1b2b25ac790389ea56e5eb005fce660d"
    );
  });

  test("changes when the external ID changes", () => {
    mocks.env.PLAIN_CHAT_HMAC_SECRET = "chat_secret_example";
    expect(
      computePlainCustomerDetailsSignature({ email: "ada@example.com", externalId: "user_123" })
    ).not.toBe(computePlainCustomerDetailsSignature({ email: "ada@example.com", externalId: "user_456" }));
  });
});
