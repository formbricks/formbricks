/**
 * Whether a link is an absolute web URL a visitor can actually open: `http://` or `https://` with a real
 * host — `localhost`, an IP address, or a domain whose labels are letters, digits and hyphens and whose
 * top-level domain is 2+ letters (or punycode). `https://asd.`, `https://asd` and `https://asd.c` fail.
 *
 * One rule for every place a creative link is written: the editor (On click link, banner text links),
 * the v3 creative routes and so the MCP tools on top of them.
 */

const LABEL = String.raw`[^\s/\\?#@:.\[\]]+`;
const TLD = String.raw`[^\s/\\?#@:.\[\]\d]${LABEL}`;
const HOST = String.raw`(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|\[[0-9A-Fa-f:.]+\]|(?:${LABEL}\.)+${TLD})`;

/**
 * The part of the rule a regular expression can state; the v3 contract publishes this exact pattern
 * (`CreativeLinkDestinationInput.url`, and the web branch of `CreativeTextRun.href`). It is
 * deliberately looser than `isWebUrl` — it can't tell which characters a domain label may hold once
 * a non-ASCII domain is encoded, an IP's octets or a port's range — so everything `isWebUrl` accepts
 * also matches it.
 */
export const WEB_URL_PATTERN = new RegExp(
  String.raw`^https?://(?:[^\s/?#@]+@)?${HOST}(?::\d{1,5})?(?:[/?#]\S*)?$`
);

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TOP_LEVEL_DOMAIN = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const MAX_DOMAIN_LENGTH = 253;

/** `URL.hostname` is already lower-case and punycode, and an IP address in it is already validated. */
const isRealHost = (hostname: string): boolean => {
  if (hostname === "localhost" || IPV4.test(hostname) || hostname.startsWith("[")) return true;
  if (hostname.length > MAX_DOMAIN_LENGTH) return false;
  const labels = hostname.split(".");
  const tld = labels[labels.length - 1];
  return (
    labels.length >= 2 && labels.every((label) => DOMAIN_LABEL.test(label)) && TOP_LEVEL_DOMAIN.test(tld)
  );
};

export const isWebUrl = (value: string): boolean => {
  if (!WEB_URL_PATTERN.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && isRealHost(url.hostname);
  } catch {
    return false;
  }
};
