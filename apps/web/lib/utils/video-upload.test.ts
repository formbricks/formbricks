import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import {
  checkForLoomUrl,
  checkForVimeoUrl,
  checkForYoutubeUrl,
  convertToEmbedUrl,
  extractLoomId,
  extractVimeoId,
  extractYoutubeId,
} from "./video-upload";

afterEach(() => {
  cleanup();
});

describe("checkForYoutubeUrl", () => {
  test("returns true for valid YouTube URLs", () => {
    expect(checkForYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://www.youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  test("returns false for invalid YouTube URLs", () => {
    expect(checkForYoutubeUrl("https://www.invalid.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(checkForYoutubeUrl("invalid-url")).toBe(false);
    expect(checkForYoutubeUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false); // Non-HTTPS protocol
  });
});

describe("extractYoutubeId", () => {
  test("extracts video ID from YouTube URLs", () => {
    expect(extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("returns null for invalid YouTube URLs", () => {
    expect(extractYoutubeId("https://www.invalid.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(extractYoutubeId("invalid-url")).toBeNull();
    expect(extractYoutubeId("https://youtube.com/notavalidpath")).toBeNull();
  });
});

describe("convertToEmbedUrl", () => {
  test("converts YouTube URL to embed URL", () => {
    expect(convertToEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
    expect(convertToEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
  });

  test("converts Vimeo URL to embed URL", () => {
    expect(convertToEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    expect(convertToEmbedUrl("https://www.vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789"
    );
    expect(convertToEmbedUrl("https://player.vimeo.com/video/123456789")).toBe(
      "https://player.vimeo.com/video/123456789"
    );
  });

  test("converts Loom URL to embed URL", () => {
    expect(convertToEmbedUrl("https://www.loom.com/share/abcdef123456")).toBe(
      "https://www.loom.com/embed/abcdef123456"
    );
    expect(convertToEmbedUrl("https://loom.com/share/abcdef123456")).toBe(
      "https://www.loom.com/embed/abcdef123456"
    );
    expect(convertToEmbedUrl("https://www.loom.com/embed/abcdef123456")).toBe(
      "https://www.loom.com/embed/abcdef123456"
    );
  });

  test("returns undefined for unsupported URLs", () => {
    expect(convertToEmbedUrl("https://www.invalid.com/watch?v=dQw4w9WgXcQ")).toBeUndefined();
    expect(convertToEmbedUrl("invalid-url")).toBeUndefined();
  });
});

// Testing private functions by importing them through the module system
describe("checkForVimeoUrl", () => {
  test("returns true for valid Vimeo URLs", () => {
    expect(checkForVimeoUrl("https://vimeo.com/123456789")).toBe(true);
    expect(checkForVimeoUrl("https://www.vimeo.com/123456789")).toBe(true);
  });

  test("returns false for invalid Vimeo URLs", () => {
    expect(checkForVimeoUrl("https://www.invalid.com/123456789")).toBe(false);
    expect(checkForVimeoUrl("invalid-url")).toBe(false);
    expect(checkForVimeoUrl("http://vimeo.com/123456789")).toBe(false); // Non-HTTPS protocol
  });
});

describe("checkForLoomUrl", () => {
  test("returns true for valid Loom URLs", () => {
    expect(checkForLoomUrl("https://loom.com/share/abcdef123456")).toBe(true);
    expect(checkForLoomUrl("https://www.loom.com/share/abcdef123456")).toBe(true);
  });

  test("returns false for invalid Loom URLs", () => {
    expect(checkForLoomUrl("https://www.invalid.com/share/abcdef123456")).toBe(false);
    expect(checkForLoomUrl("invalid-url")).toBe(false);
    expect(checkForLoomUrl("http://loom.com/share/abcdef123456")).toBe(false); // Non-HTTPS protocol
  });
});

describe("extractVimeoId", () => {
  test("extracts video ID from Vimeo URLs", () => {
    expect(extractVimeoId("https://vimeo.com/123456789")).toBe("123456789");
    expect(extractVimeoId("https://www.vimeo.com/123456789")).toBe("123456789");
    expect(extractVimeoId("https://player.vimeo.com/video/123456789")).toBe("123456789");
  });

  test("returns null for invalid Vimeo URLs", () => {
    expect(extractVimeoId("https://www.invalid.com/123456789")).toBeNull();
    expect(extractVimeoId("invalid-url")).toBeNull();
  });
});

describe("extractLoomId", () => {
  test("extracts video ID from Loom URLs", () => {
    expect(extractLoomId("https://loom.com/share/abcdef123456")).toBe("abcdef123456");
    expect(extractLoomId("https://www.loom.com/share/abcdef123456")).toBe("abcdef123456");
    expect(extractLoomId("https://www.loom.com/embed/abcdef123456")).toBe("abcdef123456");
  });

  test("returns null for invalid Loom URLs", async () => {
    expect(extractLoomId("https://www.invalid.com/share/abcdef123456")).toBeNull();
    expect(extractLoomId("invalid-url")).toBeNull();
    expect(extractLoomId("https://loom.com/invalid/abcdef123456")).toBeNull();
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
