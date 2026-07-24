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
    default:
      return scope;
  }
};
