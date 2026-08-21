export const OAUTH_ACCOUNT_NOT_LINKED_ERROR = "OAuthAccountNotLinked";
export const SSO_RECOVERY_COMPLETION_PATH = "/api/auth/sso/recovery/complete";

/**
 * The synthetic `Account.issuer` for our generic-OAuth providers (ENG-2343).
 *
 * Lives here, in a dependency-free module, because THREE places must produce byte-identical values and
 * a literal repeated three times is a silent-divergence bug waiting to happen:
 *
 * 1. `better-auth-providers.ts` — `accountIssuer`, what Better Auth writes and looks up.
 * 2. `account-linking.ts` — the rows SSO recovery writes itself.
 * 3. `migration/20260812110000_…` — the backfill, as a SQL literal (`'local:oauth:' || "provider"`),
 *    which cannot call TypeScript and is therefore the copy this one has to match.
 *
 * Deliberately NOT `createOAuthAccountIssuer` from `@better-auth/core/db`, even though it is public and
 * currently identical: because `accountIssuer` is set explicitly, Better Auth stores and looks up
 * whatever we hand it, so upstream's format never enters the picture — while the SQL literal in (3)
 * cannot follow an upstream change. Tracking upstream would drift us away from rows already written.
 */
export const ssoAccountIssuer = (providerId: string): string =>
  `local:oauth:${encodeURIComponent(providerId)}`;
