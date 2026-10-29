export type TOAuthPublicClient = {
  client_id?: string;
  client_name?: string;
  client_uri?: string;
  contacts?: string[];
};

export const getHostFromUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host;
  } catch {
    return null;
  }
};

export const isLocalhostHost = (host: string | null): boolean => {
  if (!host) {
    return false;
  }

  if (host.startsWith("[::1]")) {
    return host === "[::1]" || host.startsWith("[::1]:");
  }

  const [hostname] = host.split(":");
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
};

export const getOAuthScopeLabel = (scope: string, t: (key: string) => string): string => {
  switch (scope) {
    case "openid":
      return t("auth.oauth.scopes.openid");
    case "profile":
      return t("auth.oauth.scopes.profile");
    case "email":
      return t("auth.oauth.scopes.email");
    case "offline_access":
      return t("auth.oauth.scopes.offline_access");
    case "surveys:read":
      return t("auth.oauth.scopes.surveys_read");
    case "surveys:write":
      return t("auth.oauth.scopes.surveys_write");
    case "workflows:read":
      return t("auth.oauth.scopes.workflows_read");
    case "workflows:write":
      return t("auth.oauth.scopes.workflows_write");
    case "feedbackRecords:read":
      return t("auth.oauth.scopes.feedback_records_read");
    case "feedbackRecords:write":
      return t("auth.oauth.scopes.feedback_records_write");
    case "responses:read":
      return t("auth.oauth.scopes.responses_read");
    case "responses:write":
      return t("auth.oauth.scopes.responses_write");
    case "contacts:read":
      return t("auth.oauth.scopes.contacts_read");
    case "contacts:write":
      return t("auth.oauth.scopes.contacts_write");
    case "webhooks:read":
      return t("auth.oauth.scopes.webhooks_read");
    case "webhooks:write":
      return t("auth.oauth.scopes.webhooks_write");
    case "audit:read":
      return t("auth.oauth.scopes.audit_read");
    case "account:read":
      return t("auth.oauth.scopes.account_read");
    case "workspaces:write":
      return t("auth.oauth.scopes.workspaces_write");
    case "organizations:write":
      return t("auth.oauth.scopes.organizations_write");
    case "members:write":
      return t("auth.oauth.scopes.members_write");
    case "members:read":
      return t("auth.oauth.scopes.members_read");
    case "teams:read":
      return t("auth.oauth.scopes.teams_read");
    case "teams:write":
      return t("auth.oauth.scopes.teams_write");
    default:
      return scope;
  }
};
