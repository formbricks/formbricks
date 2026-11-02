import { isEmailAddressShape } from "@formbricks/types/common";
import { isWebUrl } from "@formbricks/types/web-url";
import { isStringUrl } from "@/lib/utils/url";

const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });

// A mailto: target needs at least one recipient address — `mailto:` alone, or `mailto:?subject=…`,
// would hand the respondent an empty mail draft rather than the contact the author meant.
const isValidMailtoUrl = (urlObj: URL): boolean => {
  const recipients = decodeURIComponent(urlObj.pathname);
  if (!recipients || recipients.includes(" ") || hasControlCharacter(recipients)) return false;
  return recipients.split(",").every(isEmailAddressShape);
};

export const isMailtoUrl = (url: string): boolean => url.trim().toLowerCase().startsWith("mailto:");

/**
 * Whether a URL typed into the rich-text link editor is an acceptable link target.
 *
 * Web links must be http(s) with a real host (`isWebUrl`: a domain with a real top-level domain,
 * localhost or an IP address, so `https://example.` is refused). `mailto:` links are accepted too, as
 * long as they name a recipient. Every other scheme — `javascript:`, `data:` and the like — is rejected.
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
    return isWebUrl(url);
  } catch {
    return false;
  }
};
