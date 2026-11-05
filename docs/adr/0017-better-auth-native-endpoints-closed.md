# Better Auth's own HTTP endpoints are closed unless we wrap them

`app/api/auth/[...all]/route.ts` mounts `auth.handler` raw, so every HTTP endpoint Better Auth ships is public the day we install or upgrade it, beside the server action or route that carries our policy. That gap shipped five times: native sign-up skipped the closed-instance policy (ENG-2293) and, on Cloud, Turnstile, the password rule and the email cap (ENG-3988); native password reset ignored `PASSWORD_RESET_DISABLED` (ENG-2105); `/update-user` skipped the SSO name lock; credential sign-in stayed live with `EMAIL_AUTH_DISABLED` (ENG-2072). So an endpoint whose behaviour we own is listed in `disabledPaths` in `apps/web/modules/auth/lib/auth.ts` (`/token`, `/update-user`, `/request-password-reset`, `/sign-up/email`, `/send-verification-email` today), and the app reaches it only through our action, which calls `auth.api.*` server-side, where `disabledPaths` does not apply. A policy predicate lives once (`modules/auth/lib/signup-policy.ts`), and Better Auth's `hooks.before` and create hooks stay as backstops for in-process callers.

## Considered Options

- **Re-check every policy in Better Auth hooks**: rejected, because a hook that rejects on create is swallowed into Better Auth's synthetic duplicate-email 200, and each new endpoint would need its own hook.
- **Better Auth's captcha plugin on `/sign-up/email`**: rejected; it covers only the captcha, not the input rules, limits and audit the action applies.

## Consequences

- A Better Auth upgrade is reviewed for new native endpoints, and each one is either added to `disabledPaths` or wrapped. Integration tests (`signup-native-endpoint.integration.test.ts`, `forgot-password-entry-points.integration.test.ts`) fail when a listed path reopens.
- Raw requests to a disabled path answer 404, including on self-hosted instances, where nothing legitimate calls them.
