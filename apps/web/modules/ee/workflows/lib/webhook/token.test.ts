import { describe, expect, test, vi } from "vitest";
import { isWebhookTokenMatch, webhookTokenIssuer } from "./token";

vi.unmock("crypto");
vi.mock("@/lib/constants", () => ({ ENCRYPTION_KEY: "a".repeat(64) }));

// The issuer never hands out the plaintext; reveal it from the encrypted copy as the editor would.
const issueToken = () => {
  const issued = webhookTokenIssuer.issue();
  return { ...issued, token: webhookTokenIssuer.reveal(issued.encrypted) };
};

describe("Webhook Secret URL token", () => {
  test("is 128 random bits written as 22 URL-safe characters", () => {
    expect(issueToken().token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  test("is different every time", () => {
    expect(issueToken().token).not.toBe(issueToken().token);
  });

  test("is not stored in the clear", () => {
    const { token, hash, encrypted } = issueToken();

    expect(hash).not.toContain(token);
    expect(encrypted).not.toContain(token);
  });

  test("matches its own stored hash and nothing else", () => {
    const first = issueToken();
    const second = issueToken();

    expect(isWebhookTokenMatch(first.token, first.hash)).toBe(true);
    expect(isWebhookTokenMatch(second.token, first.hash)).toBe(false);
    expect(isWebhookTokenMatch(`${first.token}x`, first.hash)).toBe(false);
    expect(isWebhookTokenMatch("", first.hash)).toBe(false);
  });
});
