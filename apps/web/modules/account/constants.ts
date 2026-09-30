// The Cloud offboarding survey a just-deleted account is sent to (ENG-1780). Deployment-specific: it is
// cross-origin on every deployment except production Cloud, so it may only ever be navigated to from the
// BROWSER — never handed to a server callback that validates origins. Better Auth's
// `GET /api/auth/delete-user/callback` runs `originCheck` on its `callbackURL` and answers
// INVALID_CALLBACK_URL for anything outside `trustedOrigins`, which killed SSO account deletion on
// staging (ENG-3260). Reach it through `getPostAccountDeletionRedirectUrl` rather than reading it here.
export const FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL =
  "https://app.formbricks.com/s/clri52y3z8f221225wjdhsoo2";

// Where the emailed SSO deletion link lands once Better Auth has deleted the account. Relative on
// purpose — that is the one shape `originCheck` accepts on every deployment (it allows relative paths,
// and otherwise only `trustedOrigins`). The page then picks the final destination client-side.
export const ACCOUNT_DELETED_PATH = "/auth/account-deleted";

// Better Auth's deleteUser `beforeDelete` throws a generic BAD_REQUEST carrying this exact message when
// the user is the sole owner of an organization on a single-org instance. The DeleteAccountModal matches
// on it to show a localized warning, so the throw and the match share one constant and can't drift apart.
export const ACCOUNT_DELETION_SOLE_OWNER_BLOCK_MESSAGE =
  "You are the only owner of this organization. Please transfer ownership to another member first.";
