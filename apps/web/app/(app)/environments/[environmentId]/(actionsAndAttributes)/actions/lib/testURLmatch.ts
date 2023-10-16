export type MatchType = "exactMatch" | "contains" | "startsWith" | "endsWith" | "notMatch" | "notContains";

export function testURLmatch(testUrl: string, pageUrlValue: string, pageUrlRule: MatchType): string {
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
}
