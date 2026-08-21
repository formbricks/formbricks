export const OAUTH_ACCOUNT_NOT_LINKED_ERROR = "OAuthAccountNotLinked";
export const SSO_RECOVERY_COMPLETION_PATH = "/api/auth/sso/recovery/complete";

/**
 * The synthetic `Account.issuer` for the providers we configure ourselves (ENG-2343).
 *
 * This is the value we PIN via `accountIssuer` on the generic-OAuth providers in
 * `better-auth-providers.ts` (azuread / openid / saml). Because it is pinned, Better Auth stores and
 * looks up exactly what we hand it, so upstream's own format never enters the picture — which is why
 * this is deliberately NOT `createOAuthAccountIssuer` from `@better-auth/core/db` even though the two
 * are currently identical. Tracking upstream here would drift us away from rows already written, and
 * the SQL backfill could not follow.
 *
 * It is NOT the answer to "what issuer does an existing row for provider X have" — a built-in social
 * provider can declare its own. Use `canonicalAccountIssuer` for that (ENG-2555).
 */
export const ssoAccountIssuer = (providerId: string): string =>
  `local:oauth:${encodeURIComponent(providerId)}`;

/**
 * The canonical `Account.issuer` for a given `Account.provider` — the value Better Auth 1.7 actually
 * keys the row on, and therefore the only value a write may use (ENG-2555).
 *
 * 1.7 keys accounts on `(issuer, accountId)` and filters every lookup on it, so a row written with the
 * wrong issuer is invisible to sign-in. Google is the trap: it is a BUILT-IN social provider that
 * declares its own `accountIssuer` upstream, so the synthetic `local:oauth:` form is wrong for it.
 * Writing `local:oauth:google` is what broke Google sign-in on 5.4-rc — the link was created, the user
 * got a session, and every subsequent sign-in bounced back through verify-before-link forever.
 *
 * This mirrors the `CASE` in `migration/20260812110000_…/migration.sql` — which got google right, and
 * whose comment already warned that "getting google wrong would leave every existing Google user
 * unmatched at sign-in". One deliberate asymmetry: the SQL `ELSE` concatenates the raw provider id
 * while this helper percent-encodes it. Identity for every provider id in use (all encoding-neutral,
 * per that migration's own comment); a provider id ever needing escaping must get an explicit `CASE`
 * arm in SQL, and `constants.test.ts` documents the divergence so it reads as known, not an
 * oversight. Four sites must agree and cannot import each other:
 *
 * 1. Better Auth itself — `provider.accountIssuer`, else `createOAuthAccountIssuer(provider.id)`.
 * 2. `account-linking.ts` — the rows SSO recovery writes.
 * 3. `migration/20260812110000_…` — the backfill, as a SQL literal.
 * 4. `migration/20260821…_repair_account_issuer` — the repair for rows (2) got wrong.
 *
 * `constants.test.ts` pins this function against upstream's own exports AND every SQL copy in both
 * migrations (the backfill's one, the repair's two), so a future Better Auth release that changes
 * google's issuer — or gives github one — or any one SQL copy drifting fails `pnpm test` rather than
 * production sign-in.
 *
 * Keyed on `Account.provider`, NOT `IdentityProvider`: the credential row's provider is `"credential"`,
 * a value that enum does not contain.
 */
export const canonicalAccountIssuer = (provider: string): string => {
  // Better Auth's own `createLocalAccountIssuer("credential")`. Unreachable from the SSO recovery
  // caller (its provider is an `IdentityProvider`, which has no `credential` member) but kept so this
  // stays a faithful mirror of the SQL, and so a future non-SSO caller cannot get it wrong.
  if (provider === "credential") return "local:credential";
  // Declared upstream in `@better-auth/core/dist/social-providers/google.mjs`.
  if (provider === "google") return "https://accounts.google.com";
  return ssoAccountIssuer(provider);
};
