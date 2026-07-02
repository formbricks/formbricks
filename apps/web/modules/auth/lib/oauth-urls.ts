import "server-only";
import { env } from "@/lib/env";

const DEFAULT_WEBAPP_URL = "http://localhost:3000";
const AUTH_BASE_PATH = "/api/auth";
const MCP_RESOURCE_PATH = "/api/mcp";
const MCP_PROTECTED_RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource/api/mcp";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const normalizeConfiguredUrl = (value: string | undefined, fallback = DEFAULT_WEBAPP_URL): URL => {
  const configured = value?.trim() || fallback;
  const url = new URL(configured);
  url.hash = "";
  url.search = "";
  url.pathname = trimTrailingSlash(url.pathname);
  return url;
};

const appendPath = (base: URL, path: string): string => {
  const basePath = trimTrailingSlash(base.pathname);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const alreadyEndsWithPath = basePath === normalizedPath || basePath.endsWith(normalizedPath);
  const pathname = alreadyEndsWithPath ? basePath : `${basePath}${normalizedPath}`;

  return `${base.origin}${pathname}`;
};

const getWebAppBaseUrl = (): URL => normalizeConfiguredUrl(env.WEBAPP_URL, DEFAULT_WEBAPP_URL);

export const getAuthIssuerUrl = (): string => {
  const authBaseUrl = normalizeConfiguredUrl(env.BETTER_AUTH_URL ?? env.NEXTAUTH_URL ?? env.WEBAPP_URL);
  return appendPath(authBaseUrl, AUTH_BASE_PATH);
};

export const getMcpResourceUrl = (): string => appendPath(getWebAppBaseUrl(), MCP_RESOURCE_PATH);

export const getMcpProtectedResourceMetadataUrl = (): string =>
  appendPath(getWebAppBaseUrl(), MCP_PROTECTED_RESOURCE_METADATA_PATH);

export const getMcpOrigin = (): string => new URL(getMcpResourceUrl()).origin;

export const MCP_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "surveys:read",
  "surveys:write",
] as const;

export const MCP_RESOURCE_SCOPES = ["surveys:read", "surveys:write"] as const;
