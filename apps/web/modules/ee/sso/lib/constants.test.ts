import { createLocalAccountIssuer, createOAuthAccountIssuer } from "@better-auth/core/db";
import { github, google } from "@better-auth/core/social-providers";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { canonicalAccountIssuer, ssoAccountIssuer } from "./constants";

/**
 * `Account.issuer` is spelled in four places that cannot import each other, and ENG-2555 happened
 * because two of them disagreed about google: the SQL backfill had a `CASE` arm for it, the TypeScript
 * helper did not, and every Google sign-in broke while the whole suite stayed green.
 *
 * So this pins `canonicalAccountIssuer` against the two sources it has to agree with:
 *
 * - the SQL literal, parsed out of the migration rather than restated here — restating it would just
 *   move the drift into this file;
 * - Better Auth's own exports, which are what actually key the row at sign-in.
 *
 * The upstream leg is the one with a future in it: if a Better Auth release changes google's issuer, or
 * gives github one it does not have today, this fails at `pnpm test` instead of at somebody's login.
 */
const ISSUER_BACKFILL_MIGRATION = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/database/migration/20260812110000_eng_2343_better_auth_17_resource_model/migration.sql"
);

/**
 * The `CASE` arms of the `UPDATE "Account" SET "issuer" = …` backfill, as `{ provider: issuer }`, plus
 * the `ELSE` template. Parsed, not transcribed.
 */
const parseIssuerCase = (): { arms: Record<string, string>; elseTemplate: string } => {
  const sql = readFileSync(ISSUER_BACKFILL_MIGRATION, "utf8");
  const block = /UPDATE "Account"\s+SET "issuer" = CASE([\s\S]*?)END/.exec(sql);
  if (!block) throw new Error("issuer backfill CASE not found — did the migration move or get renamed?");

  const arms: Record<string, string> = {};
  const armPattern = /WHEN "provider" = '([^']+)' THEN '([^']+)'/g;
  let match = armPattern.exec(block[1]);
  while (match) {
    arms[match[1]] = match[2];
    match = armPattern.exec(block[1]);
  }

  const elseArm = /ELSE '([^']+)' \|\| "provider"/.exec(block[1]);
  if (!elseArm) throw new Error("issuer backfill ELSE arm not found");

  return { arms, elseTemplate: elseArm[1] };
};

describe("canonicalAccountIssuer ↔ the ENG-2343 SQL backfill", () => {
  const { arms, elseTemplate } = parseIssuerCase();

  // Guard the guard: if the regex silently matched nothing, every assertion below would pass against an
  // empty object and prove precisely nothing.
  test("the migration's CASE parsed, and still special-cases exactly credential and google", () => {
    expect(Object.keys(arms).sort()).toEqual(["credential", "google"]);
    expect(elseTemplate).toBe("local:oauth:");
  });

  test.each(Object.entries(parseIssuerCase().arms))("agrees with the SQL for %s", (provider, expected) => {
    expect(canonicalAccountIssuer(provider)).toBe(expected);
  });

  test.each(["github", "azuread", "openid", "saml"])("agrees with the SQL ELSE arm for %s", (provider) => {
    expect(canonicalAccountIssuer(provider)).toBe(`${elseTemplate}${provider}`);
  });
});

describe("canonicalAccountIssuer ↔ Better Auth's own account key", () => {
  const providerOptions = { clientId: "pin-test", clientSecret: "pin-test" };

  /**
   * How upstream resolves the issuer (`better-auth/dist/oauth2/account-key.mjs`): a provider's declared
   * `accountIssuer` wins, and only its absence falls back to the synthetic form.
   */
  test("google declares its own issuer, and we use that rather than the synthetic form", () => {
    const declared = google(providerOptions).accountIssuer;

    expect(declared).toBe("https://accounts.google.com");
    expect(canonicalAccountIssuer("google")).toBe(declared);
    // The regression itself: this is the value that was written, and it is not the one BA looks under.
    expect(canonicalAccountIssuer("google")).not.toBe(ssoAccountIssuer("google"));
  });

  /**
   * Pins the *assumption* behind the fallback, not just the fallback. If a future release gives github a
   * declared issuer, `local:oauth:github` silently becomes wrong for it in exactly the way it was wrong
   * for google — and this is what notices.
   */
  test("github declares none, so the synthetic fallback is the right answer for it", () => {
    // `in` rather than reading the property: upstream's type for github has no `accountIssuer` at all,
    // so this is checked at compile time as well as here. If a release adds one, the property appears
    // and this fails — which is the notification we want.
    expect("accountIssuer" in github(providerOptions)).toBe(false);
    expect(canonicalAccountIssuer("github")).toBe(createOAuthAccountIssuer("github"));
  });

  test("credential matches Better Auth's local account issuer", () => {
    expect(canonicalAccountIssuer("credential")).toBe(createLocalAccountIssuer("credential"));
  });
});

describe("ssoAccountIssuer stays the pinning helper", () => {
  // It is still correct for the generic providers we pin `accountIssuer` on, and this records that the
  // two helpers are deliberately different rather than one being a leftover.
  test.each(["azuread", "openid", "saml"])("%s keeps the synthetic form", (provider) => {
    expect(ssoAccountIssuer(provider)).toBe(`local:oauth:${provider}`);
    expect(canonicalAccountIssuer(provider)).toBe(ssoAccountIssuer(provider));
  });

  test("percent-encodes a provider id that needs it", () => {
    expect(ssoAccountIssuer("team/github")).toBe("local:oauth:team%2Fgithub");
  });
});
