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
        throw new Error(t("environments.actions.invalid_regex"));
      }

      return regex.test(testUrl);
    default:
      throw new Error(t("environments.actions.invalid_match_type"));
  }
};

// Helper function to validate callback URLs
export const isValidCallbackUrl = (url: string, WEBAPP_URL: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    const allowedSchemes = ["https:", "http:"];

    // Extract the domain from WEBAPP_URL
    const parsedWebAppUrl = new URL(WEBAPP_URL);
    const allowedDomains = [parsedWebAppUrl.hostname];

    return allowedSchemes.includes(parsedUrl.protocol) && allowedDomains.includes(parsedUrl.hostname);
  } catch (err) {
    return false;
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
