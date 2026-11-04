import {
  SSO_RECOVERY_COMPLETION_PATH,
  SSO_RECOVERY_SIGN_IN_PATH,
  normalizeRoutePathname,
} from "@/modules/auth/lib/verification-links";

export const OAUTH_ACCOUNT_NOT_LINKED_ERROR = "OAuthAccountNotLinked";

/**
 * Does this callback URL point back into the recovery flow itself? (ENG-2783)
 *
 * `getValidatedCallbackUrl` checks origin, scheme and credentials — never the path — so a recovery URL
 * is a perfectly valid same-origin callback, and the "log in" link on the verification-requested page
 * hands one straight back to `/auth/login`. Signing in with the same IdP from there re-enters
 * `startSsoRecovery` carrying the previous attempt's completion URL, which is the loop that used to
 * grow the URL past nginx's request line.
 *
 * The opaque state id removed the growth, but not the loop: without this check, attempt N's intent
 * would still store attempt N-1's completion URL, so finishing recovery would redirect into another
 * completion whose intent is already consumed — dropping the user on "recovery failed" immediately
 * after a recovery that actually worked.
 *
 * Deliberately NOT folded into `getValidatedCallbackUrl`: `buildVerificationLinks` puts the completion
 * URL on the emailed link *through* that helper, so rejecting the path there would break the mail.
 *
 * Compared through `normalizeRoutePathname` so this agrees with the router rather than with a subset of
 * it — a check stricter than Next's own resolution leaves exactly the shapes it misses as a way back
 * into the loop.
 */
export const isSsoRecoveryInternalCallbackUrl = (callbackUrl: string): boolean => {
  const pathname = normalizeRoutePathname(callbackUrl);

  return pathname === SSO_RECOVERY_COMPLETION_PATH || pathname === SSO_RECOVERY_SIGN_IN_PATH;
};

/**
 * The synthetic `Account.issuer` for the providers we configure ourselves (ENG-2343): azuread / openid /
 * saml, and the fallback for any provider without a declared one.
 *
 * Better Auth 1.7.3 removed `Account.issuer` from its model and 1.7.7 keys accounts on
 * `(providerId, accountId)` alone, so nothing pins this on the provider config any more. We still write
 * it, because a 1.7.0 pod (a rolling deploy, or a rollback) finds the row by it, and a NULL issuer sends
 * its user through verify-before-link recovery. Drop it together with `credential-issuer-heal.ts` once
 * a rollback to 1.7.0 is off the table.
 *
 * It is NOT the answer to "what issuer does an existing row for provider X have" — a built-in social
 * provider can declare its own. Use `canonicalAccountIssuer` for that (ENG-2555).
 */
export const ssoAccountIssuer = (providerId: string): string =>
  `local:oauth:${encodeURIComponent(providerId)}`;

/**
 * The canonical `Account.issuer` for a given `Account.provider` — the value Better Auth 1.7.0 keyed the
 * row on, and therefore the only value a write may use while a 1.7.0 pod can still read it (ENG-2555).
 *
 * 1.7.0 keyed accounts on `(issuer, accountId)` and filtered every lookup on it, so a row written with
 * the wrong issuer is invisible to its sign-in. Google is the trap: it is a BUILT-IN social provider that
 * declared its own `accountIssuer` upstream, so the synthetic `local:oauth:` form is wrong for it.
 * Writing `local:oauth:google` is what broke Google sign-in on 5.4-rc — the link was created, the user
 * got a session, and every subsequent sign-in bounced back through verify-before-link forever.
 *
 * This mirrors the `CASE` in `migration/20260812110000_…/migration.sql` — which got google right, and
 * whose comment already warned that "getting google wrong would leave every existing Google user
 * unmatched at sign-in". One deliberate asymmetry: the SQL `ELSE` concatenates the raw provider id
 * while this helper percent-encodes it. Identity for every provider id in use (all encoding-neutral,
 * per that migration's own comment); a provider id ever needing escaping must get an explicit `CASE`
 * arm in SQL, and `constants.test.ts` documents the divergence so it reads as known, not an
 * oversight. Three sites must agree and cannot import each other:
 *
 * 1. `account-linking.ts` — the rows SSO recovery writes.
 * 2. `migration/20260812110000_…` — the backfill, as a SQL literal.
 * 3. `migration/20260821…_repair_account_issuer` — the repair for rows (1) got wrong.
 *
 * `constants.test.ts` pins this function against every SQL copy in both migrations (the backfill's one,
 * the repair's two), so any one copy drifting fails `pnpm test` rather than production sign-in.
 *
 * Keyed on `Account.provider`, NOT `IdentityProvider`: the credential row's provider is `"credential"`,
 * a value that enum does not contain.
 */
export const canonicalAccountIssuer = (provider: string): string => {
  // What 1.7.0's `createLocalAccountIssuer("credential")` returned. Unreachable from the SSO recovery
  // caller (its provider is an `IdentityProvider`, which has no `credential` member) but kept so this
  // stays a faithful mirror of the SQL, and so a future non-SSO caller cannot get it wrong.
  if (provider === "credential") return "local:credential";
  // What 1.7.0's built-in google provider declared as its `accountIssuer`.
  if (provider === "google") return "https://accounts.google.com";
  return ssoAccountIssuer(provider);
};
