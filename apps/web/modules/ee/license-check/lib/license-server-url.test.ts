import { describe, expect, test } from "vitest";
import { resolveLicenseServerUrl } from "./license-server-url";

const PRODUCTION = "https://ee.formbricks.com";
const STAGING = "https://staging.ee.formbricks.com";

// ENTERPRISE_LICENSE_SERVER_URL must never redirect the licence check of a production build: a
// self-run licence server would otherwise unlock every Enterprise feature (ENG-6602).
describe("ENTERPRISE_LICENSE_SERVER_URL override is honoured only in development with a loopback host", () => {
  test.each([
    ["http://localhost:8080", "http://localhost:8080"],
    ["http://localhost:8080/", "http://localhost:8080"],
    ["http://127.0.0.1:8080", "http://127.0.0.1:8080"],
    ["http://[::1]:8080", "http://[::1]:8080"],
    ["http://licenses.localhost:8080", "http://licenses.localhost:8080"],
    ["https://LOCALHOST:8443", "https://localhost:8443"],
  ])("uses %s in development", (overrideUrl, expected) => {
    expect(resolveLicenseServerUrl({ nodeEnv: "development", environment: "production", overrideUrl })).toBe(
      expected
    );
  });

  test.each(["production", "test", undefined])("ignores it when NODE_ENV is %s", (nodeEnv) => {
    expect(
      resolveLicenseServerUrl({ nodeEnv, environment: "production", overrideUrl: "http://localhost:8080" })
    ).toBe(PRODUCTION);
  });

  test.each([
    "https://licenses.example.com",
    "http://192.168.1.20:8080",
    "http://10.0.0.5:8080",
    "http://localhost.example.com",
    "http://localhost@example.com",
    "http://127.0.0.1.example.com",
    "ftp://localhost:8080",
    "not a url",
  ])("ignores the non-loopback %s in development", (overrideUrl) => {
    expect(resolveLicenseServerUrl({ nodeEnv: "development", environment: "production", overrideUrl })).toBe(
      PRODUCTION
    );
  });

  test("falls back to the environment's server when no override is set", () => {
    expect(
      resolveLicenseServerUrl({ nodeEnv: "development", environment: "production", overrideUrl: undefined })
    ).toBe(PRODUCTION);
    expect(
      resolveLicenseServerUrl({ nodeEnv: "production", environment: "staging", overrideUrl: undefined })
    ).toBe(STAGING);
    expect(resolveLicenseServerUrl({ nodeEnv: "development", environment: "staging", overrideUrl: "" })).toBe(
      STAGING
    );
  });

  test("an ignored override falls back to staging on the staging environment", () => {
    expect(
      resolveLicenseServerUrl({
        nodeEnv: "production",
        environment: "staging",
        overrideUrl: "http://localhost:8080",
      })
    ).toBe(STAGING);
  });
});
