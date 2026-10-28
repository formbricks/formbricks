// Where billing-role users (and other "you can't see this page" cases) get sent. Billing is an
// organization-level concern and lives in the account shell.
export const getOrganizationBillingPath = (organizationId: string): string =>
  `/organizations/${organizationId}/billing`;
