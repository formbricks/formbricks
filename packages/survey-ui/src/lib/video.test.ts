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
