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

/** The URL input's border and background for the result of the endpoint check, if there is one. */
export const getEndpointAccessibleClassName = (endpointAccessible: boolean | undefined): string | null => {
  if (endpointAccessible === true) return "border-green-500 bg-green-50";
  if (endpointAccessible === false) return "border-red-200 bg-red-50";
  if (endpointAccessible === undefined) return "border-slate-200 bg-white";
  return null;
};
