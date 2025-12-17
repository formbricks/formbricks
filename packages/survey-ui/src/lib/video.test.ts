import { describe, expect, test } from "vitest";
import { checkForLoomUrl, checkForVimeoUrl, checkForYoutubeUrl, convertToEmbedUrl } from "./video";

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
