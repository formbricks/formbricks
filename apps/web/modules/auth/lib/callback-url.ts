import { getValidatedCallbackUrl } from "@/lib/utils/url";

export const AUTH_CALLBACK_URL_COOKIE_NAMES = [
  "__Secure-next-auth.callback-url",
  "next-auth.callback-url",
] as const;

type TCookieStore = {
  get: (name: string) => { value: string } | undefined;
};

const getSearchParamValue = (value?: string | string[]): string | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
};

export const getAuthCallbackUrlFromCookies = (cookieStore: TCookieStore): string | null => {
  for (const cookieName of AUTH_CALLBACK_URL_COOKIE_NAMES) {
    const callbackUrl = cookieStore.get(cookieName)?.value;

    if (callbackUrl) {
      return callbackUrl;
    }
  }

  return null;
};

export const resolveAuthCallbackUrl = ({
  searchParamCallbackUrl,
  cookieCallbackUrl,
  webAppUrl,
}: {
  searchParamCallbackUrl?: string | string[];
  cookieCallbackUrl?: string | null;
  webAppUrl: string;
}): string | null => {
  const callbackUrlFromSearchParams = getSearchParamValue(searchParamCallbackUrl);

  return (
    getValidatedCallbackUrl(callbackUrlFromSearchParams, webAppUrl) ??
    getValidatedCallbackUrl(cookieCallbackUrl, webAppUrl)
  );
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
