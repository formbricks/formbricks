export const validWebHookURL = (urlInput: string, allowInternalUrls = false) => {
  const trimmedInput = urlInput.trim();
  if (!trimmedInput) {
    return { valid: false, error: "Please enter a URL" };
  }

  try {
    const url = new URL(trimmedInput);

    if (allowInternalUrls) {
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return { valid: false, error: "URL must start with https:// or http://" };
      }
      return { valid: true };
    }

    if (url.protocol !== "https:") {
      return { valid: false, error: "URL must start with https://" };
    }

    const domainError: string =
      "Please enter a complete URL with a valid domain (e.g., https://formbricks.com)";

    const multipleSlashesPattern = /(?<!:)\/\/+/;
    if (multipleSlashesPattern.test(trimmedInput)) {
      return {
        valid: false,
        error: domainError,
      };
    }

    const validDomainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!validDomainPattern.test(url.hostname)) {
      return {
        valid: false,
        error: domainError,
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format. Please enter a complete URL including https://" };
  }
};

export const isDiscordWebhook = (urlString: string) => {
  const url = new URL(urlString);
  const DISCORD_WEBHOOK_URL_PATTERN = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/.+$/;
  return DISCORD_WEBHOOK_URL_PATTERN.test(url.toString());
};

/** The URL field's border and fill for the last endpoint test: passed, failed, or not yet run. */
export const getEndpointStatusClassName = (endpointAccessible: boolean | undefined): string => {
  if (endpointAccessible === true) return "border-green-500 bg-green-50";
  if (endpointAccessible === false) return "border-red-200 bg-red-50";
  return "border-slate-200 bg-white";
};

export type TNewWebhookInputProblem = "missing_url" | "missing_trigger" | "missing_survey" | "discord_url";

/**
 * What keeps a new webhook from being saved, checked in the order the form reports it, or null when
 * nothing does. Throws, like `isDiscordWebhook`, when `url` is not a URL.
 */
export const getNewWebhookInputProblem = ({
  url,
  triggerCount,
  allSurveys,
  surveyCount,
}: {
  url: string;
  triggerCount: number;
  allSurveys: boolean;
  surveyCount: number;
}): TNewWebhookInputProblem | null => {
  if (!url) return "missing_url";
  if (triggerCount === 0) return "missing_trigger";
  if (!allSurveys && surveyCount === 0) return "missing_survey";
  if (isDiscordWebhook(url)) return "discord_url";
  return null;
};
