import { describe, expect, test } from "vitest";
import {
  checkForLoomUrl,
  checkForVimeoUrl,
  checkForYoutubeUrl,
  convertToEmbedUrl,
  extractYoutubeId,
} from "./video-upload";

describe("checkForYoutubeUrl", () => {
  const validUrls = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ];
  const invalidUrls = [
    "http://www.youtube.com/watch?v=dQw4w9WgXcQ", // wrong protocol
    "https://www.google.com",
    "https://vimeo.com/12345",
    "not_a_url",
  ];

  validUrls.forEach((url) => {
    test(`should return true for valid YouTube URL: ${url}`, () => {
      expect(checkForYoutubeUrl(url)).toBe(true);
    });
  });

  invalidUrls.forEach((url) => {
    test(`should return false for invalid YouTube URL: ${url}`, () => {
      expect(checkForYoutubeUrl(url)).toBe(false);
    });
  });
});

describe("checkForVimeoUrl", () => {
  const validUrls = ["https://vimeo.com/123456789", "https://www.vimeo.com/123456789"];
  const invalidUrls = [
    "http://vimeo.com/123456789",
    "https://www.youtube.com",
    "https://example.com/vimeo/123",
    "not_a_url",
  ];

  validUrls.forEach((url) => {
    test(`should return true for valid Vimeo URL: ${url}`, () => {
      expect(checkForVimeoUrl(url)).toBe(true);
    });
  });

  invalidUrls.forEach((url) => {
    test(`should return false for invalid Vimeo URL: ${url}`, () => {
      expect(checkForVimeoUrl(url)).toBe(false);
    });
  });
});

describe("checkForLoomUrl", () => {
  const validUrls = ["https://www.loom.com/share/123abc456def", "https://loom.com/share/123abc456def"];
  const invalidUrls = [
    "http://loom.com/share/123abc456def",
    "https://www.youtube.com",
    "https://example.com/loom/123",
    "not_a_url",
  ];

  validUrls.forEach((url) => {
    test(`should return true for valid Loom URL: ${url}`, () => {
      expect(checkForLoomUrl(url)).toBe(true);
    });
  });

  invalidUrls.forEach((url) => {
    test(`should return false for invalid Loom URL: ${url}`, () => {
      expect(checkForLoomUrl(url)).toBe(false);
    });
  });
});

describe("extractYoutubeId", () => {
  const urlsAndIds: [string, string | null][] = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL...", "dQw4w9WgXcQ"],
    ["https://www.vimeo.com/12345", null],
    ["not_a_youtube_url", null],
    ["https://www.youtube.com/watch?v=", null], // no id
  ];

  urlsAndIds.forEach(([url, expectedId]) => {
    test(`should extract ID "${expectedId}" from URL: ${url}`, () => {
      expect(extractYoutubeId(url)).toBe(expectedId);
    });
  });
});

describe("convertToEmbedUrl", () => {
  const urlsAndEmbeds: [string, string | undefined][] = [
    ["https://www.youtube.com/watch?v=videoId123", "https://www.youtube.com/embed/videoId123"],
    ["https://youtu.be/videoId456", "https://www.youtube.com/embed/videoId456"],
    ["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789"],
    ["https://www.loom.com/share/loomId789", "https://www.loom.com/embed/loomId789"],
    ["https://example.com/somevideo", undefined],
    ["not_a_url_at_all", undefined],
    ["https://www.youtube.com/watch?v=", undefined], // No ID, so extractYoutubeId returns null
    ["https://vimeo.com/novideoid", undefined], // No ID
    ["https://www.loom.com/share/", undefined], // No ID
  ];

  urlsAndEmbeds.forEach(([url, expectedEmbedUrl]) => {
    test(`should convert "${url}" to "${expectedEmbedUrl}"`, () => {
      expect(convertToEmbedUrl(url)).toBe(expectedEmbedUrl);
    });
  });
});

describe("extractYoutubeId — stored-value denial of service (ENG-2789)", () => {
  // The pattern list this replaced used `youtube\\.com.*v=(…)`, whose `.*` backtracks once per
  // `youtube.com`. `ZStorageUrl` is an unbounded `z.string()`, so a value this long persists and
  // reaches the RESPONDENT renderer, where `element-media.tsx` converts it twice per render.
  test("a long repeated-host URL resolves fast instead of blocking the thread", () => {
    const stored = `https://youtube.com/${"youtube.com/".repeat(25_600)}`; // 307,220 characters

    const startedAt = performance.now();
    const result = extractYoutubeId(stored);
    const elapsedMs = performance.now() - startedAt;

    expect(result).toBeNull();
    // Budget chosen from measurements, not a round number: the scan costs 6ms uninstrumented but
    // ~330ms under the coverage run CI uses, which slows tight character loops far more than it
    // slows a native regex. The pattern this replaced takes ~3300ms on the same input either way,
    // so 2000ms sits above the instrumented pass and below the regression it guards against.
    expect(elapsedMs).toBeLessThan(2000);
  });

  // Greedy `.*` took the LAST marker on the line and backtracked to an earlier one when the last
  // had no id after it. Both are load-bearing, so they are pinned rather than left to the corpus.
  test.each([
    ["https://www.youtube.com/watch?x=v=FIRST&v=SECOND", "SECOND"],
    ["https://youtube.com/embed/abc/embed/def", "def"],
    ["https://youtube.com/watch?v=&v=OK", "OK"],
    ["https://youtube.com/watch?v=&v=", null],
    // `.` cannot cross a line terminator, so a marker on the next line is not reachable.
    ["youtube.com\nv=NEXTLINE", null],
    ["youtube.com v=SAMELINE\nyoutube.com v=SECOND", "SAMELINE"],
  ])("resolves %s to %s, as the pattern did", (url, expected) => {
    expect(extractYoutubeId(url)).toBe(expected);
  });
});
