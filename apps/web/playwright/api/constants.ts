export const RESPONSES_API_URL = `/api/v2/management/responses`;
export const SURVEYS_API_URL = `/api/v1/management/surveys`;
export const WEBHOOKS_API_URL = `/api/v2/management/webhooks`;
export const ROLES_API_URL = `/api/v2/roles`;

export const TEAMS_API_URL = (organizationId: string) => `/api/v2/organizations/${organizationId}/teams`;
export const PROJECT_TEAMS_API_URL = (organizationId: string) =>
  `/api/v2/organizations/${organizationId}/project-teams`;
