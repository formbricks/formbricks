export const FORMBRICKS_CLOUD_ACCOUNT_DELETION_SURVEY_URL =
  "https://app.formbricks.com/s/clri52y3z8f221225wjdhsoo2";

// Better Auth's deleteUser `beforeDelete` throws a generic BAD_REQUEST carrying this exact message when
// the user is the sole owner of an organization on a single-org instance. The DeleteAccountModal matches
// on it to show a localized warning, so the throw and the match share one constant and can't drift apart.
export const ACCOUNT_DELETION_SOLE_OWNER_BLOCK_MESSAGE =
  "You are the only owner of this organization. Please transfer ownership to another member first.";
