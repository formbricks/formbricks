import { describe, expect, test } from "vitest";
import { isPlainChatConfigured, isPlainChatMissingVerification } from "./plain-chat-config";

describe("isPlainChatConfigured", () => {
  test("is true only when both the app id and the HMAC secret are set", () => {
    expect(isPlainChatConfigured({ appId: "app_1", hmacSecret: "secret" })).toBe(true);
  });

  test("is false when the HMAC secret is missing, so the chat never runs unverified", () => {
    expect(isPlainChatConfigured({ appId: "app_1" })).toBe(false);
    expect(isPlainChatConfigured({ appId: "app_1", hmacSecret: "" })).toBe(false);
  });

  test("is false without an app id", () => {
    expect(isPlainChatConfigured({ hmacSecret: "secret" })).toBe(false);
    expect(isPlainChatConfigured({})).toBe(false);
  });
});

describe("isPlainChatMissingVerification", () => {
  test("flags an app id without a secret", () => {
    expect(isPlainChatMissingVerification({ appId: "app_1" })).toBe(true);
  });

  test("does not flag a complete or an absent configuration", () => {
    expect(isPlainChatMissingVerification({ appId: "app_1", hmacSecret: "secret" })).toBe(false);
    expect(isPlainChatMissingVerification({})).toBe(false);
    expect(isPlainChatMissingVerification({ hmacSecret: "secret" })).toBe(false);
  });
});
