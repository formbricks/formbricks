import type { Config, MatchType } from "@formbricks/types/js";

export const checkPageUrl = (config: Config, track: (eventName: string) => void): void => {
  const pageUrlEvents = config.settings?.noCodeEvents.filter(
    (event) => event.noCodeConfig?.type === "pageUrl"
  );
  if (pageUrlEvents.length === 0) {
    return;
  }
  for (const event of pageUrlEvents) {
    const {
      noCodeConfig: { pageUrl },
    } = event;
    if (!pageUrl) {
      continue;
    }
    const match = checkUrlMatch(window.location.href, pageUrl.value, pageUrl.rule);
    if (match) {
      track(event.name);
    }
  }
};

export function checkUrlMatch(url: string, pageUrlValue: string, pageUrlRule: MatchType): boolean {
  switch (pageUrlRule) {
    case "exactMatch":
      return url === pageUrlValue;
    case "contains":
      return url.includes(pageUrlValue);
    case "startsWith":
      return url.startsWith(pageUrlValue);
    case "endsWith":
      return url.endsWith(pageUrlValue);
    case "notMatch":
      return url !== pageUrlValue;
    case "notContains":
      return !url.includes(pageUrlValue);
    default:
      throw new Error("Invalid match type");
  }
}
