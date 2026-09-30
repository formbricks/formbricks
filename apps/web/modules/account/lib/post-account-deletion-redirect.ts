import { FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL } from "@/modules/account/constants";

/**
 * Where a visitor goes once their account has actually been deleted: the Cloud offboarding survey on
 * Formbricks Cloud (ENG-1780), the login page everywhere else.
 *
 * Both deletion paths navigate here from the BROWSER — the credential one from DeleteAccountModal after
 * `authClient.deleteUser` resolves, the SSO email-link one from the `/auth/account-deleted` page the
 * emailed callback redirects to. That is what makes the survey reachable at all: it is cross-origin on
 * every deployment except production Cloud, so Better Auth's `originCheck` rejects it as a server-side
 * `callbackURL` and the emailed link dies with INVALID_CALLBACK_URL (ENG-3260). A client-side navigation
 * has no such gate, and one helper keeps the two paths from drifting apart again.
 *
 * `isFormbricksCloud` is a parameter rather than a read of `@/lib/constants` so this stays importable
 * from client components; callers on the server pass `IS_FORMBRICKS_CLOUD`.
 */
export const getPostAccountDeletionRedirectUrl = (isFormbricksCloud: boolean): string =>
  isFormbricksCloud ? FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL : "/auth/login";
