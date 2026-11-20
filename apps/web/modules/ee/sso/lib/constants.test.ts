import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { canonicalAccountIssuer, ssoAccountIssuer } from "./constants";

/**
 * `Account.issuer` is spelled in three places that cannot import each other, and ENG-2555 happened
 * because two of them disagreed about google: the SQL backfill had a `CASE` arm for it, the TypeScript
 * helper did not, and every Google sign-in broke while the whole suite stayed green.
 *
 * Better Auth 1.7.7 no longer reads `Account.issuer`, but 1.7.0 pods still do, so we keep writing the
 * value to keep a rollback to 1.7.0 working. This pins `canonicalAccountIssuer` against the SQL
 * literals, parsed out of the migrations rather than restated here — restating them would just move the
 * drift into this file.
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

describe("canonicalAccountIssuer for the providers Better Auth 1.7.0 declared an issuer for", () => {
  // 1.7.0 resolved the issuer from the provider's own declaration (google: `https://accounts.google.com`),
  // falling back to the synthetic `local:oauth:<id>` form. Those values are frozen into rows written
  // by 1.7.0 and by the migrations, so they are asserted here as literals, not read from upstream.
  test("google keeps its declared issuer, not the synthetic form", () => {
    expect(canonicalAccountIssuer("google")).toBe("https://accounts.google.com");
    expect(canonicalAccountIssuer("google")).not.toBe(ssoAccountIssuer("google"));
  });

  test("github falls back to the synthetic form", () => {
    expect(canonicalAccountIssuer("github")).toBe("local:oauth:github");
  });

  test("credential is the local credential issuer", () => {
    expect(canonicalAccountIssuer("credential")).toBe("local:credential");
  });
});

describe("ssoAccountIssuer", () => {
  // The synthetic form for the generic providers (azuread / openid / saml) and the fallback arm of
  // `canonicalAccountIssuer`; kept as its own helper because google's canonical value is not this form.
  test.each(["azuread", "openid", "saml"])("%s keeps the synthetic form", (provider) => {
    expect(ssoAccountIssuer(provider)).toBe(`local:oauth:${provider}`);
    expect(canonicalAccountIssuer(provider)).toBe(ssoAccountIssuer(provider));
  });

  test("percent-encodes a provider id that needs it", () => {
    expect(ssoAccountIssuer("team/github")).toBe("local:oauth:team%2Fgithub");
  });
});
