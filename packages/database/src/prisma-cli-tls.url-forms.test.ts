import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";
import { PrismaCliTlsConfigError, resolvePrismaCliTls } from "./prisma-cli-tls";

// URL forms the app's node-postgres reads as TLS (ENG-7464), and inputs it would read differently from the
// migrations. Every claim about pg is checked against pg-connection-string itself.
const base = "postgresql://app:s3cret@db.example.com:5432/formbricks";
const caFile = "/run/certs/postgres-ca.pem";
const fileExists = (filePath: string): boolean => filePath === caFile;
const resolve = (url: string, env: NodeJS.ProcessEnv = {}) => resolvePrismaCliTls(url, env, fileExists);
const strictUrl = (query = "") => `${base}?${query ? `${query}&` : ""}sslmode=require&sslaccept=strict`;

// node-postgres reads the URL through pg-connection-string, the same copy the app's connections use.
const pgConnectionString = createRequire(createRequire(import.meta.url).resolve("pg"))(
  "pg-connection-string"
) as { parse: (url: string) => Record<string, unknown> };
const pgParse = pgConnectionString.parse;

describe("resolvePrismaCliTls: URL forms node-postgres reads as TLS (ENG-7464)", () => {
  test.each(["true", "1"])("verifies ssl=%s against the OS store, as the app's pg does", (value) => {
    expect(pgParse(`${base}?ssl=${value}`).ssl).toBe(true);
    expect(resolve(`${base}?ssl=${value}`)).toEqual({
      databaseUrl: `${base}?ssl=${value}&sslmode=require&sslaccept=strict`,
      verifiesServerCertificate: true,
    });
  });

  test("requires TLS without a certificate check for ssl=no-verify", () => {
    expect(resolve(`${base}?ssl=no-verify`)).toEqual({
      databaseUrl: `${base}?ssl=no-verify&sslmode=require`,
      verifiesServerCertificate: false,
    });
  });

  test("keeps ssl=0 plaintext, as the app's pg does", () => {
    expect(pgParse(`${base}?ssl=0`).ssl).toBe(false);
    expect(resolve(`${base}?ssl=0`)).toEqual({
      databaseUrl: `${base}?ssl=0&sslmode=disable`,
      verifiesServerCertificate: false,
    });
  });

  test("keeps ssl=0 plaintext next to sslaccept, as pg lets the URL's ssl=0 win", () => {
    expect(pgParse(`${base}?ssl=0&sslaccept=strict`).ssl).toBe(false);
    expect(resolve(`${base}?ssl=0&sslaccept=strict`)).toEqual({
      databaseUrl: `${base}?ssl=0&sslaccept=strict&sslmode=disable`,
      verifiesServerCertificate: false,
    });
    // ssl=no-verify asks for TLS, which sslaccept=strict then checks.
    expect(resolve(`${base}?ssl=no-verify&sslaccept=strict`)).toEqual({
      databaseUrl: `${base}?ssl=no-verify&sslaccept=strict&sslmode=require`,
      verifiesServerCertificate: true,
    });
    // PGSSLMODE=disable, which pg ignores once the URL sets sslaccept, is still overridden.
    expect(resolve(`${base}?sslaccept=strict`, { PGSSLMODE: "disable" })).toEqual({
      databaseUrl: `${base}?sslaccept=strict&sslmode=require`,
      verifiesServerCertificate: true,
    });
  });

  test.each(["false", "yes", "TRUE", "require"])(
    "rejects ssl=%s, which pg reads as verified TLS, without echoing the value",
    (value) => {
      const call = () => resolve(`${base}?ssl=${value}`);
      expect(call).toThrow("Unsupported ssl in the database URL");
      expect(call).not.toThrow(/s3cret/);
      expect(call).not.toThrow(value);
    }
  );

  test("does not echo URL values that could hold part of a password", () => {
    for (const query of ["ssl=p4ss", "sslmode=p4ss", "sslnegotiation=p4ss"]) {
      expect(() => resolve(`${base}?${query}`)).toThrow(PrismaCliTlsConfigError);
      expect(() => resolve(`${base}?${query}`)).not.toThrow(/p4ss/);
    }
  });

  test("lets the URL's sslmode win over ssl, as pg does", () => {
    expect(resolve(`${base}?ssl=true&sslmode=disable`)).toEqual({
      databaseUrl: `${base}?ssl=true&sslmode=disable`,
      verifiesServerCertificate: false,
    });
    expect(pgParse(`${base}?ssl=true&sslmode=disable`).ssl).toBe(false);
  });

  test.each([
    ["sslcert alone", "sslcert=/c.pem", `${base}?sslmode=require&sslaccept=strict`],
    ["sslkey alone", "sslkey=/k.pem", `${base}?sslkey=%2Fk.pem&sslmode=require&sslaccept=strict`],
    [
      "sslcert and sslkey",
      "sslcert=/c.pem&sslkey=/k.pem",
      `${base}?sslkey=%2Fk.pem&sslmode=require&sslaccept=strict`,
    ],
    [
      "ssl=0 next to sslcert, which pg overrides",
      "ssl=0&sslcert=/c.pem",
      `${base}?ssl=0&sslmode=require&sslaccept=strict`,
    ],
  ])("verifies %s against the OS store and drops the client certificate", (_name, query, expected) => {
    expect(resolve(`${base}?${query}`)).toEqual({ databaseUrl: expected, verifiesServerCertificate: true });
  });

  test("keeps sslcert as Prisma's CA when sslaccept names the dialect", () => {
    expect(resolve(`${base}?sslaccept=strict&sslcert=/ca.pem`)).toEqual({
      databaseUrl: `${base}?sslaccept=strict&sslcert=%2Fca.pem&sslmode=require`,
      verifiesServerCertificate: true,
    });
  });

  test("raises sslnegotiation=direct to a verified handshake, but never rejects PGSSLMODE for it", () => {
    // This app's pg-connection-string ignores sslnegotiation, so the app follows PGSSLMODE there.
    expect(pgParse(`${base}?sslnegotiation=direct`).ssl).toBeUndefined();
    for (const mode of ["disable", "require", "verify-full"]) {
      expect(resolve(`${base}?sslnegotiation=direct`, { PGSSLMODE: mode })).toEqual({
        databaseUrl: `${base}?sslnegotiation=direct&sslmode=require&sslaccept=strict`,
        verifiesServerCertificate: true,
      });
    }
    expect(resolve(`${base}?ssl=0&sslnegotiation=direct`)).toMatchObject({ verifiesServerCertificate: true });
    // A URL sslmode wins, as it does in every pg version.
    expect(resolve(`${base}?sslmode=disable&sslnegotiation=direct`)).toMatchObject({
      verifiesServerCertificate: false,
    });
  });

  test("leaves sslnegotiation=postgres alone and rejects an unknown value", () => {
    expect(resolve(`${base}?sslnegotiation=postgres`)).toEqual({
      databaseUrl: `${base}?sslnegotiation=postgres`,
      verifiesServerCertificate: false,
    });
    expect(() => resolve(`${base}?sslnegotiation=fast`)).toThrow(PrismaCliTlsConfigError);
  });

  test.each(["sslmode", "sslrootcert", "sslcert", "sslkey", "sslaccept", "ssl", "sslnegotiation"])(
    "rejects an empty %s",
    (name) => {
      expect(() => resolve(`${base}?${name}=`)).toThrow(`${name} is empty`);
    }
  );

  test("rejects an empty URL sslrootcert instead of falling back to PGSSLROOTCERT", () => {
    expect(() => resolve(`${base}?sslmode=require&sslrootcert=`, { PGSSLROOTCERT: caFile })).toThrow(
      "sslrootcert is empty"
    );
  });

  test("warns about an opt-out only when the URL asks for verification", () => {
    expect(resolve(`${base}?ssl=true&sslaccept=accept_invalid_certs`)).toMatchObject({
      verifiesServerCertificate: false,
      verificationSkipped: true,
    });
    expect(resolve(`${base}?sslmode=require&sslaccept=accept_invalid_certs`)).not.toHaveProperty(
      "verificationSkipped"
    );
  });
});

describe("resolvePrismaCliTls: PGSSLMODE next to URL TLS parameters, which pg ignores", () => {
  test.each([
    ["ssl=true", "disable"],
    ["ssl=true", "no-verify"],
    ["ssl=true", "require"],
    ["ssl=true", "prefer"],
    ["ssl=no-verify", "disable"],
    ["sslcert=/c.pem", "require"],
    [`sslrootcert=${caFile}`, "disable"],
    [`sslrootcert=${caFile}`, "no-verify"],
  ])("rejects %s with PGSSLMODE=%s, which would weaken migrations alone", (query, mode) => {
    const call = () => resolve(`${base}?${query}`, { PGSSLMODE: mode });
    expect(call).toThrow(PrismaCliTlsConfigError);
    expect(call).toThrow(`PGSSLMODE=${mode}`);
  });

  test.each(["prefer", "allow", "require", "verify-ca", "verify-full"])(
    "keeps verifying a URL sslrootcert with PGSSLMODE=%s",
    (mode) => {
      expect(resolve(`${base}?sslrootcert=${caFile}`, { PGSSLMODE: mode })).toEqual({
        databaseUrl: strictUrl(),
        verifiesServerCertificate: true,
        rootCertFile: caFile,
      });
    }
  );

  test("lets PGSSLMODE make migrations stricter than the URL", () => {
    expect(resolve(`${base}?ssl=no-verify`, { PGSSLMODE: "verify-full" })).toEqual({
      databaseUrl: `${base}?ssl=no-verify&sslmode=require&sslaccept=strict`,
      verifiesServerCertificate: true,
    });
    expect(resolve(`${base}?ssl=true`, { PGSSLMODE: "verify-full" })).toMatchObject({
      verifiesServerCertificate: true,
    });
  });

  test("names PGSSLMODE when the unsupported sslmode came from there", () => {
    expect(() => resolve(base, { PGSSLMODE: "bogus" })).toThrow("in PGSSLMODE");
    expect(() => resolve(`${base}?sslrootcert=system`, { PGSSLMODE: "require" })).toThrow(
      "but PGSSLMODE sets sslmode=require"
    );
  });
});

describe("resolvePrismaCliTls: URLs pg decodes differently", () => {
  test.each([
    ["a tab inside a name", "ss\tl=true"],
    ["a newline inside a name", "sslmode=disable&ssl\nmode=verify-full"],
    ["a carriage return in a value", "ssl=tr\rue"],
    ["another control character", "sslmode=verify-full&application_name=a\u0001b"],
  ])("rejects %s, which WHATWG URL parsing deletes or pg keeps, without echoing the URL", (_name, query) => {
    const call = () => resolve(`${base}?${query}`);
    expect(call).toThrow("control character");
    expect(call).not.toThrow(/s3cret/);
  });

  test("pg reads a tab inside a TLS name as if it were not there", () => {
    expect(pgParse(`${base}?ss\tl=true`).ssl).toBe(true);
  });

  test("trims a trailing newline, which pg and Prisma drop too", () => {
    expect(pgParse(`${base}?ssl=true\n`).ssl).toBe(true);
    expect(resolve(`${base}?ssl=true\n`)).toEqual({
      databaseUrl: `${base}?ssl=true&sslmode=require&sslaccept=strict`,
      verifiesServerCertificate: true,
    });
    expect(resolve(`${base}\n`)).toEqual({ databaseUrl: base, verifiesServerCertificate: false });
  });

  test("accepts a leading space pg reads the same way, and rejects one next to a trailing newline it keeps", () => {
    expect(pgParse(`  ${base}?sslmode=verify-full`).sslmode).toBe("verify-full");
    expect(resolve(`  ${base}?sslmode=verify-full`)).toEqual({
      databaseUrl: strictUrl(),
      verifiesServerCertificate: true,
    });
    expect(pgParse(`  ${base}?ssl=true\n`).ssl).toBe("true\n");
    expect(() => resolve(`  ${base}?ssl=true\n`)).toThrow("reads ssl in the database URL differently");
  });

  // A space at the edge alone sends pg-connection-string down its re-encoding path, so pg keeps it in the last value.
  test.each([
    ["sslmode=disable ", "sslmode", "disable "],
    ["ssl=0 ", "ssl", "0 "],
  ])("rejects %j, whose trailing space pg keeps in the value", (query, name, pgValue) => {
    expect(pgParse(`${base}?${query}`)[name]).toBe(pgValue);
    const call = () => resolve(`${base}?${query}`);
    expect(call).toThrow(`reads ${name} in the database URL differently`);
    expect(call).not.toThrow(/s3cret/);
  });

  test("pg-connection-string reads a hex-escaped name literally once a space triggers its re-encoding", () => {
    const parsed = pgParse(`${base}?sslmode=verify-full&ssl%6Dode=disable&application_name=a b`);
    expect(parsed.sslmode).toBe("verify-full");
    expect(parsed["ssl%6Dode"]).toBe("disable");
    // Without the trigger, pg decodes it as URLSearchParams does.
    expect(pgParse(`${base}?ssl%6Dode=disable`).sslmode).toBe("disable");
  });

  test.each([
    ["with a space elsewhere", "sslmode=verify-full&ssl%6Dode=disable&application_name=a b"],
    ["without one", "ssl%6Dode=disable"],
    ["with a digit escape", "ssl%6dode=require"],
    ["for sslrootcert", "sslmode=verify-full&ssl%72ootcert=/other.pem"],
  ])("rejects a percent-encoded TLS parameter name %s", (_name, query) => {
    expect(() => resolve(`${base}?${query}`)).toThrow("percent-encoded");
  });

  test("rejects a TLS value pg would leave escaped", () => {
    const url = `${base}?sslmode=disab%6Ce&application_name=a b`;
    expect(pgParse(url).sslmode).toBe("disab%6Ce");
    const call = () => resolve(url);
    expect(call).toThrow("reads sslmode in the database URL differently");
    expect(call).not.toThrow(/s3cret/);
  });

  test.each([
    ["a digit escape pg restores", `sslmode=verify-full&sslrootcert=/certs/my%20ca.pem&application_name=a b`],
    ["an escape outside the TLS parameters", "sslmode=verify-full&application_name=a%zzb"],
    ["no space or malformed escape", "sslmode=verify-full&sslrootcert=%2Frun%2Fcerts%2Fpostgres-ca.pem"],
  ])("accepts %s", (_name, query) => {
    const exists = () => true;
    expect(() => resolvePrismaCliTls(`${base}?${query}`, {}, exists)).not.toThrow();
  });

  test("rejects a hex-escaped TLS path when the URL triggers pg's re-encoding", () => {
    expect(() =>
      resolvePrismaCliTls(
        `${base}?sslmode=verify-full&sslrootcert=%2Fca.pem&application_name=a b`,
        {},
        () => true
      )
    ).toThrow("reads sslrootcert in the database URL differently");
  });

  test("leaves a URL with a space but no TLS parameters alone", () => {
    expect(resolve(`${base}?application_name=a b`)).toEqual({
      databaseUrl: `${base}?application_name=a b`,
      verifiesServerCertificate: false,
    });
  });
});
