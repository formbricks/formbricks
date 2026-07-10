import { TActionClassPageUrlRule } from "@formbricks/types/action-classes";

export const testURLmatch = (
  testUrl: string,
  pageUrlValue: string,
  pageUrlRule: TActionClassPageUrlRule,
  t: (key: string) => string
): boolean => {
  let regex: RegExp;

  switch (pageUrlRule) {
    case "exactMatch":
      return testUrl === pageUrlValue;
    case "contains":
      return testUrl.includes(pageUrlValue);
    case "startsWith":
      return testUrl.startsWith(pageUrlValue);
    case "endsWith":
      return testUrl.endsWith(pageUrlValue);
    case "notMatch":
      return testUrl !== pageUrlValue;
    case "notContains":
      return !testUrl.includes(pageUrlValue);
    case "matchesRegex":
      try {
        regex = new RegExp(pageUrlValue);
      } catch {
        throw new Error(t("workspace.actions.invalid_regex"));
      }

      return regex.test(testUrl);
    default:
      throw new Error(t("workspace.actions.invalid_match_type"));
  }
};

// Helper function to validate callback URLs
export const getValidatedCallbackUrl = (
  url: string | null | undefined,
  WEBAPP_URL: string
): string | null => {
  if (!url) {
    return null;
  }

  try {
    const parsedWebAppUrl = new URL(WEBAPP_URL);
    const isAbsoluteUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url);
    const isRootRelativePath = url.startsWith("/");

    // Reject ambiguous non-URL values like "foo" while still allowing safe root-relative paths.
    if (!isAbsoluteUrl && !isRootRelativePath) {
      return null;
    }

    const parsedUrl = isAbsoluteUrl ? new URL(url) : new URL(url, parsedWebAppUrl.origin);
    const allowedSchemes = ["https:", "http:"];
    const allowedOrigins = new Set([parsedWebAppUrl.origin]);

    if (!allowedSchemes.includes(parsedUrl.protocol)) {
      return null;
    }

    if (!allowedOrigins.has(parsedUrl.origin)) {
      return null;
    }

    if (parsedUrl.username || parsedUrl.password) {
      return null;
    }

    // A same-origin absolute URL can still carry a scheme-relative pathname ("//evil.example").
    // Consumers that reduce the URL to pathname+search+hash (login's router.push) would then
    // navigate off-origin. Reject it here so every consumer is protected. Backslash and
    // dot-segment variants normalize to a "//" pathname before this check. (ENG-1636)
    if (parsedUrl.pathname.startsWith("//")) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
};

export const isStringUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
