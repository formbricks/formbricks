import { getValidatedCallbackUrl } from "@/lib/utils/url";

const getSearchParamValue = (value?: string | string[]): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

// The post-login redirect target comes from the `callbackUrl` search param. The legacy NextAuth
// `next-auth.callback-url` cookie fallback was removed in ENG-1054 — Better Auth carries callbackURL
// as a query param, so nothing set that cookie anymore (it was a dead read).
export const resolveAuthCallbackUrl = ({
  searchParamCallbackUrl,
  webAppUrl,
}: {
  searchParamCallbackUrl?: string | string[];
  webAppUrl: string;
}): string | null => {
  const callbackUrlFromSearchParams = getSearchParamValue(searchParamCallbackUrl);
  return getValidatedCallbackUrl(callbackUrlFromSearchParams, webAppUrl);
};

export const getRelativeCallbackUrl = (callbackUrl: string | null | undefined, webAppUrl: string): string => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, webAppUrl);

  if (!validatedCallbackUrl) {
    return "/";
  }

  const parsedCallbackUrl = new URL(validatedCallbackUrl);
  const relativeCallbackUrl = `${parsedCallbackUrl.pathname}${parsedCallbackUrl.search}${parsedCallbackUrl.hash}`;

  return relativeCallbackUrl || "/";
};

export const getInviteTokenFromCallbackUrl = (
  callbackUrl: string | null | undefined,
  webAppUrl: string
): string | null => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, webAppUrl);

  if (!validatedCallbackUrl) {
    return null;
  }

  return new URL(validatedCallbackUrl).searchParams.get("token");
};

export const getSearchParamString = (value?: string | string[]): string => getSearchParamValue(value) ?? "";
