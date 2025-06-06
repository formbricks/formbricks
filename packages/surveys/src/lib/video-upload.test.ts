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
