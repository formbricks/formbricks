export type MatchType = "exactMatch" | "contains" | "startsWith" | "endsWith" | "notMatch" | "notContains";

export function testURLmatch(url1: string, url2: string, matchType: MatchType): string {
  switch (matchType) {
    case "exactMatch":
      return url1 === url2 ? "yes" : "no";
    case "contains":
      return url1.includes(url2) ? "yes" : "no";
    case "startsWith":
      return url1.startsWith(url2) ? "yes" : "no";
    case "endsWith":
      return url1.endsWith(url2) ? "yes" : "no";
    case "notMatch":
      return url1 !== url2 ? "yes" : "no";
    case "notContains":
      return !url1.includes(url2) ? "yes" : "no";
    default:
      throw new Error("Invalid match type");
  }
}
