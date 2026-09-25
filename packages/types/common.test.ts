import { describe, expect, test } from "vitest";
import { ZEndingCardUrl } from "./common";

const isValid = (url: string): boolean => ZEndingCardUrl.safeParse(url).success;

// ENG-2585: the ending card's button URL and redirect URL only had to start with http(s)://, so
// "http://google" or "https://" saved and sent respondents nowhere. Hidden-field URLs (#7139) still
// have to pass: a host that is a recall value can only be checked once the survey runs.
describe("ZEndingCardUrl", () => {
  test.each([
    "https://example.com",
    "http://example.com/thanks?id=1#top",
    "https://sub.example.co.uk/path",
    " https://example.com ",
    "https://xn--bcher-kva.example",
    "https://bücher.example",
    "http://localhost:3000/done",
    "http://192.168.0.1/done",
    "http://[::1]:8080/",
  ])("accepts %s", (url) => {
    expect(isValid(url)).toBe(true);
  });

  test.each([
    ["http://google", "no top-level domain"],
    ["https://", "no host"],
    ["https://.com", "empty label"],
    ["https://example.", "empty top-level domain"],
    ["https://-example.com", "label starting with a hyphen"],
    ["https://exa mple.com", "space in the host"],
    ["https://example.c", "one-letter top-level domain"],
    ["https://example.123", "numeric top-level domain"],
    ["ftp://example.com", "wrong protocol"],
    ["example.com", "no protocol"],
  ])("rejects %s (%s)", (url) => {
    expect(isValid(url)).toBe(false);
  });

  test.each([
    "https://#recall:url123/fallback:example.com#",
    "https://#recall:test123/fallback:example.com",
    "https://example.com/?user=#recall:uid/fallback:anonymous#",
    "https://example.com/#recall:path/fallback:#",
  ])("accepts a hidden-field URL: %s", (url) => {
    expect(isValid(url)).toBe(true);
  });
});
