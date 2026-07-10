export const FORMBRICKS_SURVEYS_FILTERS_KEY_LS = "formbricks-surveys-filters";
export const FORMBRICKS_ENVIRONMENT_ID_LS = "formbricks-environment-id";
export const FORMBRICKS_WORKSPACE_ID_LS = "formbricks-workspace-id";
export const FORMBRICKS_LOGGED_IN_WITH_LS = "formbricks-logged-in-with";

// Server-readable mirror of the "last active workspace". The proxy sets this from the
// /workspaces/[workspaceId] path so server components (e.g. the workspace-agnostic org-settings
// shell) can resolve the current workspace during render — localStorage is browser-only.
export const FORMBRICKS_WORKSPACE_ID_COOKIE = "formbricks-workspace-id";
