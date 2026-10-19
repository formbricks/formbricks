import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { getPgConnectionConfig } from "./pg-connection-config";

const databaseUrl = "postgresql://app:secret@database:5432/formbricks";

beforeEach(() => {
  vi.stubEnv("PGSSLMODE", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("PostgreSQL connection TLS configuration", () => {
  test.each([
    ["accept_invalid_certs", false],
    ["strict", true],
  ])("enables TLS for sslaccept=%s", (sslaccept, rejectUnauthorized) => {
    const config = getPgConnectionConfig(`${databaseUrl}?sslaccept=${sslaccept}`);

    expect(config).toEqual({ connectionString: databaseUrl, ssl: { rejectUnauthorized } });
    expect(new Client(config).ssl).toEqual({ rejectUnauthorized });
  });

  test("warns and enables certificate verification for an unknown sslaccept", () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const config = getPgConnectionConfig(`${databaseUrl}?sslaccept=unexpected`);

    expect(new Client(config).ssl).toEqual({ rejectUnauthorized: true });
    expect(warn).toHaveBeenCalledWith(
      { sslaccept: "unexpected" },
      "Unknown sslaccept value in DATABASE_URL; defaulting to strict (rejectUnauthorized: true)"
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
  });

  test("leaves TLS unspecified when the URL does not request it", () => {
    const config = getPgConnectionConfig(databaseUrl);

    expect(config).toEqual({ connectionString: databaseUrl });
    expect(new Client(config).ssl).toBe(false);
  });

  test.each([
    ["disable", false],
    ["no-verify", { rejectUnauthorized: false }],
    ["verify-full", {}],
  ])("preserves native sslmode=%s", (sslmode, expected) => {
    const config = getPgConnectionConfig(`${databaseUrl}?sslmode=${sslmode}`);

    expect(config).not.toHaveProperty("ssl");
    expect(new Client(config).ssl).toEqual(expected);
  });

  test("preserves PGSSLMODE fallback when sslaccept is absent", () => {
    vi.stubEnv("PGSSLMODE", "no-verify");

    expect(new Client(getPgConnectionConfig(databaseUrl)).ssl).toEqual({ rejectUnauthorized: false });
  });

  test("lets explicit sslaccept override the environment", () => {
    vi.stubEnv("PGSSLMODE", "disable");

    expect(new Client(getPgConnectionConfig(`${databaseUrl}?sslaccept=strict`)).ssl).toEqual({
      rejectUnauthorized: true,
    });
  });

  test.each([
    ["strict", "no-verify", { rejectUnauthorized: false }],
    ["accept_invalid_certs", "disable", false],
  ])("preserves native URL precedence for sslaccept=%s and sslmode=%s", (sslaccept, sslmode, expected) => {
    const config = getPgConnectionConfig(`${databaseUrl}?sslaccept=${sslaccept}&sslmode=${sslmode}`);

    expect(new Client(config).ssl).toEqual(expected);
  });

  test("preserves credentials and every other URL parameter", () => {
    const original = new URL(databaseUrl);
    original.password = "encoded@password:/?#";
    original.search =
      "sslaccept=strict&sslrootcert=%2Ftmp%2Fca.pem&schema=customer&connection_limit=10&options=-c%20search_path%3Dcustomer&application_name=migration";
    const config = getPgConnectionConfig(original.toString());
    const expected = new URL(original);
    expected.searchParams.delete("sslaccept");

    expect(config.connectionString).toBe(expected.toString());
    expect(config.ssl).toEqual({ rejectUnauthorized: true });
  });
});
