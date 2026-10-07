import { describe, expect, test } from "vitest";
import { ConfigError, loadConfig, redact } from "./config.ts";

const base = { FORMBRICKS_URL: "https://app.example.com", FORMBRICKS_API_KEY: "fbk_secret123" };

describe("loadConfig", () => {
  test("applies defaults and falls back PUBLIC_URL to URL", () => {
    expect(loadConfig(base)).toEqual({
      url: "https://app.example.com",
      publicUrl: "https://app.example.com",
      splitDomain: false,
      apiKey: "fbk_secret123",
      workspaceId: undefined,
      storage: "auto",
      timeoutMs: 30_000,
    });
  });

  test("detects a split-domain install and trims trailing slashes", () => {
    const config = loadConfig({
      ...base,
      FORMBRICKS_URL: "https://admin.example.com/",
      FORMBRICKS_PUBLIC_URL: "https://surveys.example.com//",
    });

    expect(config.url).toBe("https://admin.example.com");
    expect(config.publicUrl).toBe("https://surveys.example.com");
    expect(config.splitDomain).toBe(true);
  });

  test("reads an empty variable (docker -e VAR=) as unset", () => {
    const config = loadConfig({
      ...base,
      FORMBRICKS_PUBLIC_URL: "",
      CHECK_STORAGE: "",
      FORMBRICKS_WORKSPACE_ID: "",
    });

    expect(config.splitDomain).toBe(false);
    expect(config.storage).toBe("auto");
    expect(config.workspaceId).toBeUndefined();
  });

  test.each(["auto", "true", "false"] as const)("accepts CHECK_STORAGE=%s", (value) => {
    expect(loadConfig({ ...base, CHECK_STORAGE: value }).storage).toBe(value);
  });

  test("rejects an unknown CHECK_STORAGE value", () => {
    expect(() => loadConfig({ ...base, CHECK_STORAGE: "maybe" })).toThrow(ConfigError);
  });

  test("names every missing required variable", () => {
    expect(() => loadConfig({})).toThrow(/FORMBRICKS_URL[\s\S]*FORMBRICKS_API_KEY/);
  });

  test("rejects a non-http URL", () => {
    expect(() => loadConfig({ ...base, FORMBRICKS_URL: "ftp://app.example.com" })).toThrow(/FORMBRICKS_URL/);
  });

  test("reads the timeout as a number", () => {
    expect(loadConfig({ ...base, CHECK_TIMEOUT_MS: "5000" }).timeoutMs).toBe(5000);
  });

  test("never puts the API key in a validation error", () => {
    const attempt = () => loadConfig({ ...base, FORMBRICKS_URL: "not a url" });

    expect(attempt).toThrow(ConfigError);
    expect(attempt).not.toThrow(/fbk_secret123/);
  });
});

describe("redact", () => {
  test("replaces every occurrence of the key", () => {
    const config = loadConfig(base);

    expect(redact("x-api-key: fbk_secret123 and again fbk_secret123", config)).toBe(
      "x-api-key: [redacted] and again [redacted]"
    );
  });

  test("leaves text alone when the key is empty", () => {
    expect(redact("nothing to hide", { apiKey: "" })).toBe("nothing to hide");
  });
});
