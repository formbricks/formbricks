import { describe, expect, test } from "vitest";
import {
  checkForLoomUrl,
  checkForVimeoUrl,
  checkForYoutubeUrl,
  convertToEmbedUrl,
  isSafeMediaUrl,
} from "./video";

describe("checkForYoutubeUrl", () => {
  test("returns true for valid YouTube URLs with https", () => {
    expect(checkForYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://www.youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(true);
    expect(checkForYoutubeUrl("https://youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(true);
  });

  test("returns false for YouTube URLs with http", () => {
    expect(checkForYoutubeUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
  });

  test("returns false for invalid URLs", () => {
    expect(checkForYoutubeUrl("not-a-url")).toBe(false);
    expect(checkForYoutubeUrl("")).toBe(false);
  });

  test("returns false for non-YouTube domains", () => {
    expect(checkForYoutubeUrl("https://vimeo.com/123456")).toBe(false);
    expect(checkForYoutubeUrl("https://example.com")).toBe(false);
  });
});

describe("checkForVimeoUrl", () => {
  test("returns true for valid Vimeo URLs with https", () => {
    expect(checkForVimeoUrl("https://www.vimeo.com/123456789")).toBe(true);
    expect(checkForVimeoUrl("https://vimeo.com/123456789")).toBe(true);
  });

  test("returns false for Vimeo URLs with http", () => {
    expect(checkForVimeoUrl("http://www.vimeo.com/123456789")).toBe(false);
  });

  test("returns false for invalid URLs", () => {
    expect(checkForVimeoUrl("not-a-url")).toBe(false);
    expect(checkForVimeoUrl("")).toBe(false);
  });

  test("returns false for non-Vimeo domains", () => {
    expect(checkForVimeoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(checkForVimeoUrl("https://example.com")).toBe(false);
  });
});

describe("checkForLoomUrl", () => {
  test("returns true for valid Loom URLs with https", () => {
    expect(checkForLoomUrl("https://www.loom.com/share/abc123")).toBe(true);
    expect(checkForLoomUrl("https://loom.com/share/abc123")).toBe(true);
  });

  test("returns false for Loom URLs with http", () => {
    expect(checkForLoomUrl("http://www.loom.com/share/abc123")).toBe(false);
  });

  test("returns false for invalid URLs", () => {
    expect(checkForLoomUrl("not-a-url")).toBe(false);
    expect(checkForLoomUrl("")).toBe(false);
  });

  test("returns false for non-Loom domains", () => {
    expect(checkForLoomUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(false);
    expect(checkForLoomUrl("https://example.com")).toBe(false);
  });
});

describe("convertToEmbedUrl", () => {
  describe("YouTube URL conversion", () => {
    test("converts youtu.be URLs to embed format", () => {
      const result = convertToEmbedUrl("https://youtu.be/dQw4w9WgXcQ");
      expect(result).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    });

    test("converts www.youtu.be URLs to embed format", () => {
      const result = convertToEmbedUrl("https://www.youtu.be/dQw4w9WgXcQ");
      expect(result).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    });

    test("converts youtube.com/watch URLs to embed format", () => {
      const result = convertToEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(result).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    });

    test("converts youtube.com/embed URLs to embed format", () => {
      const result = convertToEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ");
      expect(result).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    });

    test("converts youtube-nocookie.com/embed URLs to embed format", () => {
      const result = convertToEmbedUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
      expect(result).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    });

    test("handles YouTube URLs with additional parameters", () => {
      const result = convertToEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s");
      expect(result).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    });

    test("returns undefined for invalid YouTube URLs", () => {
      const result = convertToEmbedUrl("https://www.youtube.com/invalid");
      expect(result).toBeUndefined();
    });
  });

  describe("Vimeo URL conversion", () => {
    test("converts vimeo.com URLs to embed format", () => {
      const result = convertToEmbedUrl("https://www.vimeo.com/123456789");
      expect(result).toBe("https://player.vimeo.com/video/123456789");
    });

    test("converts www.vimeo.com URLs to embed format", () => {
      const result = convertToEmbedUrl("https://vimeo.com/987654321");
      expect(result).toBe("https://player.vimeo.com/video/987654321");
    });

    test("handles already-embedded Vimeo URLs", () => {
      const result = convertToEmbedUrl("https://player.vimeo.com/video/123456789");
      expect(result).toBe("https://player.vimeo.com/video/123456789");
    });

    test("handles Vimeo URLs with query parameters", () => {
      const result = convertToEmbedUrl("https://vimeo.com/123456789?some=param");
      expect(result).toBe("https://player.vimeo.com/video/123456789");
    });

    test("returns undefined for invalid Vimeo URLs", () => {
      const result = convertToEmbedUrl("https://www.vimeo.com/invalid");
      expect(result).toBeUndefined();
    });
  });

  describe("Loom URL conversion", () => {
    test("converts loom.com/share URLs to embed format", () => {
      const result = convertToEmbedUrl("https://www.loom.com/share/abc123def456");
      expect(result).toBe("https://www.loom.com/embed/abc123def456");
    });

    test("converts www.loom.com/share URLs to embed format", () => {
      const result = convertToEmbedUrl("https://loom.com/share/xyz789");
      expect(result).toBe("https://www.loom.com/embed/xyz789");
    });

    test("handles already-embedded Loom URLs", () => {
      const result = convertToEmbedUrl("https://www.loom.com/embed/abc123def456");
      expect(result).toBe("https://www.loom.com/embed/abc123def456");
    });

    test("handles Loom URLs with query parameters", () => {
      const result = convertToEmbedUrl("https://www.loom.com/share/abc123def456?some=param");
      expect(result).toBe("https://www.loom.com/embed/abc123def456");
    });

    test("returns undefined for invalid Loom URLs", () => {
      const result = convertToEmbedUrl("https://www.loom.com/invalid");
      expect(result).toBeUndefined();
    });
  });

  describe("Unsupported URLs", () => {
    test("returns undefined for unsupported video platforms", () => {
      expect(convertToEmbedUrl("https://example.com/video")).toBeUndefined();
      expect(convertToEmbedUrl("https://dailymotion.com/video/xyz")).toBeUndefined();
    });

    test("returns undefined for invalid URLs", () => {
      expect(convertToEmbedUrl("not-a-url")).toBeUndefined();
      expect(convertToEmbedUrl("")).toBeUndefined();
    });
  });
});

describe("isSafeMediaUrl", () => {
  // Regression: these values come from an editable survey field and used to be rendered straight into
  // an anchor `href`, where a `javascript:` URL executes on click.
  test.each([
    "javascript:alert(document.domain)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "not a url",
    "",
    // Protocol-relative: a browser resolves these against the page's scheme and lands on the
    // attacker's origin, so they are not the "relative storage path" the leading slash suggests.
    "//attacker.example/file",
    String.raw`/\attacker.example/file`,
  ])("rejects %s", (url) => {
    expect(isSafeMediaUrl(url)).toBe(false);
  });

  test.each(["https://www.youtube.com/embed/abc", "http://example.com/a.png", "/storage/ws_1/private/a.png"])(
    "accepts %s",
    (url) => {
      expect(isSafeMediaUrl(url)).toBe(true);
    }
  );
});

describe("extractYoutubeId — stored-value denial of service (ENG-2789)", () => {
  // The pattern list this replaced used `youtube\\.com.*v=(…)`, whose `.*` backtracks once per
  // `youtube.com`. `ZStorageUrl` is an unbounded `z.string()`, so a value this long persists and
  // reaches the RESPONDENT renderer, where `element-media.tsx` converts it twice per render.
  test("a long repeated-host URL resolves fast instead of blocking the thread", () => {
    const stored = `https://youtube.com/${"youtube.com/".repeat(25_600)}`; // 307,220 characters

    const startedAt = performance.now();
    const result = convertToEmbedUrl(stored);
    const elapsedMs = performance.now() - startedAt;

    expect(result).toBeUndefined();
    // Budget chosen from measurements, not a round number: the scan costs 6ms uninstrumented but
    // ~330ms under the coverage run CI uses, which slows tight character loops far more than it
    // slows a native regex. The pattern this replaced takes ~3300ms on the same input either way,
    // so 2000ms sits above the instrumented pass and below the regression it guards against.
    expect(elapsedMs).toBeLessThan(2000);
  });

  // Greedy `.*` took the LAST marker on the line and backtracked to an earlier one when the last
  // had no id after it. Both are load-bearing, so they are pinned rather than left to the corpus.
  test.each([
    ["https://www.youtube.com/watch?x=v=FIRST&v=SECOND", "https://www.youtube.com/embed/SECOND"],
    ["https://youtube.com/embed/abc/embed/def", "https://www.youtube.com/embed/def"],
    ["https://youtube.com/watch?v=&v=OK", "https://www.youtube.com/embed/OK"],
    ["https://youtube.com/watch?v=&v=", undefined],
  ])("resolves %s to %s, as the pattern did", (url, expected) => {
    expect(convertToEmbedUrl(url)).toBe(expected);
  });
});
