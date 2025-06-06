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
  });

  test("converts Loom URL to embed URL", () => {
    expect(convertToEmbedUrl("https://www.loom.com/share/abcdef123456")).toBe(
      "https://www.loom.com/embed/abcdef123456"
    );
    expect(convertToEmbedUrl("https://loom.com/share/abcdef123456")).toBe(
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
  });

  test("returns null for invalid Loom URLs", async () => {
    expect(extractLoomId("https://www.invalid.com/share/abcdef123456")).toBeNull();
    expect(extractLoomId("invalid-url")).toBeNull();
    expect(extractLoomId("https://loom.com/invalid/abcdef123456")).toBeNull();
  });
});
