import { isStringUrl } from "@/lib/utils/url";

// A mailto: target needs at least one recipient address — `mailto:` alone, or `mailto:?subject=…`,
// would hand the respondent an empty mail draft rather than the contact the author meant.
const isValidMailtoUrl = (urlObj: URL): boolean => {
  const recipients = decodeURIComponent(urlObj.pathname);
  if (!recipients || recipients.includes(" ")) return false;
  return recipients.split(",").every((recipient) => {
    const atIndex = recipient.indexOf("@");
    return atIndex > 0 && atIndex < recipient.length - 1;
  });
};

/**
 * Whether a URL typed into the rich-text link editor is an acceptable link target.
 *
 * Web links must be http(s) with a real host (a dotted domain, localhost or an IP address). `mailto:`
 * links are accepted too, as long as they name a recipient. Every other scheme — `javascript:`,
 * `data:` and the like — is rejected.
 */
export const isValidEditorLinkUrl = (url: string): boolean => {
  if (!isStringUrl(url)) {
    return false;
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === "mailto:") {
      return isValidMailtoUrl(urlObj);
    }
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
      return false;
    }
    const isIPv6 = urlObj.hostname.startsWith("[") && urlObj.hostname.endsWith("]");
    const isIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(urlObj.hostname);
    return urlObj.hostname.includes(".") || urlObj.hostname === "localhost" || isIPv6 || isIPv4;
  } catch {
    return false;
  }
};
