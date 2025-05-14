import { TActionClassPageUrlRule } from "@formbricks/types/action-classes";

export const testURLmatch = (
  testUrl: string,
  pageUrlValue: string,
  pageUrlRule: TActionClassPageUrlRule
): string => {
  switch (pageUrlRule) {
    case "exactMatch":
      return testUrl === pageUrlValue ? "yes" : "no";
    case "contains":
      return testUrl.includes(pageUrlValue) ? "yes" : "no";
    case "startsWith":
      return testUrl.startsWith(pageUrlValue) ? "yes" : "no";
    case "endsWith":
      return testUrl.endsWith(pageUrlValue) ? "yes" : "no";
    case "notMatch":
      return testUrl !== pageUrlValue ? "yes" : "no";
    case "notContains":
      return !testUrl.includes(pageUrlValue) ? "yes" : "no";
    default:
      throw new Error("Invalid match type");
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
