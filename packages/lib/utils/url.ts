export type MatchType = "exactMatch" | "contains" | "startsWith" | "endsWith" | "notMatch" | "notContains";

export const testURLmatch = (testUrl: string, pageUrlValue: string, pageUrlRule: MatchType): string => {
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

export const isValidUrl = (inputUrl: string): boolean => {
  try {
    // URL object will automatically URL-encode the input
    const url = new URL(inputUrl);

    // Check if the protocol is HTTPS
    if (url.protocol !== "https:") {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
};
