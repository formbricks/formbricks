import { describe, expect, test } from "vitest";
import { isWebUrl } from "./web-url";

describe("isWebUrl", () => {
  test.each([
    "https://example.com",
    "http://example.com",
    "https://www.example.co.uk/path?query=1#hash",
    "https://example.com/",
    "https://example.com?ref=banner",
    "https://example.com#top",
    "https://sub-domain.example-site.io:8443/a/b",
    "https://EXAMPLE.com",
    "https://user:pass@example.com",
    "http://localhost",
    "http://localhost:3000/path",
    "https://127.0.0.1",
    "https://192.168.0.1:8080",
    "https://[::1]",
    "https://[2001:db8::1]:443/x",
    "https://xn--mnchen-3ya.de",
    "https://münchen.de",
    "https://example.xn--p1ai",
    "https://例え.テスト",
  ])("accepts %s", (url) => {
    expect(isWebUrl(url)).toBe(true);
  });

  test.each([
    ["a trailing dot", "https://asdasd."],
    ["a single label and a trailing dot", "https://asd."],
    ["a single-label host", "https://asdasd"],
    ["a one-letter TLD", "https://example.c"],
    ["a numeric TLD", "https://example.123"],
    ["an empty label", "https://example..com"],
    ["a leading dot", "https://.example.com"],
    ["a label starting with a hyphen", "https://-example.com"],
    ["a label ending with a hyphen", "https://example-.com"],
    ["an underscore in the host", "https://my_host.example.com"],
    ["an IPv4 octet over 255", "https://256.1.1.1"],
    ["a short IPv4", "https://127.1"],
    ["a port over 65535", "https://example.com:70000"],
    ["no host", "https://"],
    ["no slashes", "https:example.com"],
    ["one slash", "https:/example.com"],
    ["an upper-case scheme", "HTTPS://example.com"],
    ["whitespace", "https://exa mple.com"],
    ["a leading space", " https://example.com"],
    ["a trailing space", "https://example.com "],
    ["a backslash path", String.raw`https://example.com\path`],
    ["another scheme", "ftp://example.com"],
    ["a script URL", "javascript:alert(1)"],
    ["a mailto link", "mailto:hello@example.com"],
    ["a relative path", "/pricing"],
    ["no scheme", "example.com"],
    ["an empty string", ""],
  ])("rejects %s (%s)", (_reason, url) => {
    expect(isWebUrl(url)).toBe(false);
  });
});
