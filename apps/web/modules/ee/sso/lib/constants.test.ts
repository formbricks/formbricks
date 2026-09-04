import { createLocalAccountIssuer, createOAuthAccountIssuer } from "@better-auth/core/db";
import { github, google } from "@better-auth/core/social-providers";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  SSO_RECOVERY_COMPLETION_PATH,
  SSO_RECOVERY_SIGN_IN_PATH,
} from "@/modules/auth/lib/verification-links";
import { canonicalAccountIssuer, isSsoRecoveryInternalCallbackUrl, ssoAccountIssuer } from "./constants";

const WEBAPP_URL = "https://app.example.com";

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
const MIGRATION_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/database/migration"
);

/**
 * The two SQL spellings of the canonical mapping. The ENG-2343 backfill has one `CASE`; the ENG-2555
 * repair restates it twice (`SET` and the self-excluding `WHERE`). All copies in all files must agree
 * with each other and with `canonicalAccountIssuer` — a repair that drifts would *un-fix* rows through
 * the migration meant to cure them.
 */
const ISSUER_MIGRATION_SOURCES = {
  "eng-2343 backfill": "20260812110000_eng_2343_better_auth_17_resource_model/migration.sql",
  "eng-2555 repair": "20260821165535_repair_account_issuer/migration.ts",
} as const;

interface TParsedIssuerCase {
  arms: Record<string, string>;
  elseTemplate: string;
}

/**
 * Every `"issuer" = CASE … END` block in a migration file, as `{ provider: issuer }` arms plus the
 * `ELSE` template. Parsed, not transcribed — restating the values here would just move the drift into
 * this file.
 */
const parseIssuerCases = (relativePath: string): TParsedIssuerCase[] => {
  const source = readFileSync(join(MIGRATION_DIR, relativePath), "utf8");
  const blocks = [...source.matchAll(/"issuer" (?:= CASE|IS DISTINCT FROM \(\s*CASE)([\s\S]*?)END/g)];
  if (blocks.length === 0) throw new Error(`no issuer CASE found in ${relativePath} — moved or renamed?`);

  return blocks.map(([, body]) => {
    const arms: Record<string, string> = {};
    for (const [, provider, issuer] of body.matchAll(/WHEN "provider" = '([^']+)' THEN '([^']+)'/g)) {
      arms[provider] = issuer;
    }
    const elseArm = /ELSE '([^']+)' \|\| "provider"/.exec(body);
    if (!elseArm) throw new Error(`issuer CASE in ${relativePath} has no ELSE arm`);
    return { arms, elseTemplate: elseArm[1] };
  });
};

const parsedSources = Object.entries(ISSUER_MIGRATION_SOURCES).map(([label, path]) => ({
  label,
  cases: parseIssuerCases(path),
}));

// One canonical parse for the per-arm assertions below; the cross-copy equality tests prove every
// other copy is identical to it, so asserting against one is asserting against all.
const { arms, elseTemplate } = parsedSources[0].cases[0];

describe("isSsoRecoveryInternalCallbackUrl", () => {
  /**
   * The predicate had no test of its own — the loop tests only reached it through
   * `startSsoRecovery`, so nothing pinned the trailing-slash handling that stops
   * `…/complete/` slipping past a check Next would then route to the real page anyway.
   */
  test.each([
    ["the completion path", `${WEBAPP_URL}${SSO_RECOVERY_COMPLETION_PATH}?state=abc`],
    ["the recovery sign-in path", `${WEBAPP_URL}${SSO_RECOVERY_SIGN_IN_PATH}?token=abc`],
    ["a single trailing slash", `${WEBAPP_URL}${SSO_RECOVERY_COMPLETION_PATH}/`],
    ["many trailing slashes", `${WEBAPP_URL}${SSO_RECOVERY_COMPLETION_PATH}/////`],
    ["a dot segment that normalises back", `${WEBAPP_URL}/api/auth/sso/recovery/../recovery/complete`],
    ["a root-relative form", `${SSO_RECOVERY_COMPLETION_PATH}?state=abc`],
  ])("recognises %s", (_label, callbackUrl) => {
    expect(isSsoRecoveryInternalCallbackUrl(callbackUrl)).toBe(true);
  });

  test.each([
    ["an ordinary app URL", `${WEBAPP_URL}/organizations/org_1/workspaces/ws_1/surveys`],
    ["a path that merely starts the same", `${WEBAPP_URL}${SSO_RECOVERY_COMPLETION_PATH}-not-really`],
    ["a path that merely contains it", `${WEBAPP_URL}/x${SSO_RECOVERY_COMPLETION_PATH}`],
    ["the app root", WEBAPP_URL],
    ["an unparseable value", "::::"],
  ])("leaves %s alone", (_label, callbackUrl) => {
    expect(isSsoRecoveryInternalCallbackUrl(callbackUrl)).toBe(false);
  });

  test("stays linear on the input shape that made the old regex quadratic", () => {
    // Deliberately a slash run that does NOT reach the end. `/\/+$/` (Sonar S8786) matches greedily
    // from every start position, hits the trailing `b`, fails the anchor and backtracks: measured
    // 34ms at 10k slashes, 2.9s at 100k, 313s at 1M. Trailing slashes would NOT catch this — the old
    // regex matched those on the first attempt — so the run has to end in a non-slash to bind.
    const adversarial = `${WEBAPP_URL}/a${"/".repeat(100_000)}b`;
    const started = Date.now();

    expect(isSsoRecoveryInternalCallbackUrl(adversarial)).toBe(false);

    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("canonicalAccountIssuer ↔ every SQL spelling of the mapping", () => {
  // Guard the guard: if the regex silently matched nothing, every assertion below would pass against an
  // empty object and prove precisely nothing. The repair file must contain exactly two copies (SET and
  // the self-excluding WHERE) — a refactor that drops one would weaken its idempotency, and this is
  // what notices.
  test("both migrations parsed, with the expected number of CASE copies", () => {
    expect(parsedSources.map(({ label, cases }) => [label, cases.length])).toEqual([
      ["eng-2343 backfill", 1],
      ["eng-2555 repair", 2],
    ]);
    expect(Object.keys(arms).sort()).toEqual(["credential", "google"]);
    expect(elseTemplate).toBe("local:oauth:");
  });

  // The drift that shipped ENG-2555 was two spellings of this mapping disagreeing. Every copy in every
  // migration must therefore be byte-equal to every other — including the repair's SET and WHERE pair,
  // which could otherwise drift apart and make the repair non-idempotent.
  test.each(
    parsedSources.flatMap(({ label, cases }) => cases.map((c, i) => [`${label} copy ${i + 1}`, c] as const))
  )("%s is identical to the canonical parse", (_label, parsed) => {
    expect(parsed.arms).toEqual(arms);
    expect(parsed.elseTemplate).toBe(elseTemplate);
  });

  test.each(Object.entries(arms))("agrees with the SQL for %s", (provider, expected) => {
    expect(canonicalAccountIssuer(provider)).toBe(expected);
  });

  test.each(["github", "azuread", "openid", "saml"])("agrees with the SQL ELSE arm for %s", (provider) => {
    expect(canonicalAccountIssuer(provider)).toBe(`${elseTemplate}${provider}`);
  });

  /**
   * Documents the one input class where the TS and SQL sides deliberately disagree: the SQL ELSE arm
   * concatenates the raw provider id, while the helper percent-encodes. Identity for every provider id
   * in use (all encoding-neutral) — but a future provider id carrying a reserved character would make
   * the migration write a value the app never looks up. This pins the divergence as known and
   * deliberate rather than letting it look like an oversight; enabling such a provider means adding an
   * explicit arm to the SQL, per the ENG-2343 migration's own comment.
   */
  test("the SQL ELSE arm cannot express an encoded provider id", () => {
    expect(canonicalAccountIssuer("team/github")).toBe("local:oauth:team%2Fgithub");
    expect(canonicalAccountIssuer("team/github")).not.toBe(`${elseTemplate}team/github`);
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
