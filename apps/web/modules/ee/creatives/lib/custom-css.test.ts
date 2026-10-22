import { describe, expect, test, vi } from "vitest";
import { compileCreativeCustomCss } from "./custom-css";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cache", () => ({
  cache: { withCache: (fn: () => Promise<unknown>) => fn() },
}));

describe("compileCreativeCustomCss", () => {
  test("scopes a feedback button's CSS to its own element, never to the survey root", async () => {
    const css = await compileCreativeCustomCss("feedbackButton", {
      light: ".fb-creative-button { letter-spacing: 1px; } span { color: #ff0000; }",
      dark: ".fb-creative-button { color: #ffffff; }",
    });

    expect(css?.light).toContain(".fb-creative-button{letter-spacing:1px!important}");
    expect(css?.light).toContain(".fb-creative-button span{");
    expect(css?.dark).toContain(".fb-creative-button[data-appearance=dark]{");
    expect(JSON.stringify(css)).not.toContain("#fbjs");
  });

  test("scopes a banner's CSS to the banner", async () => {
    const css = await compileCreativeCustomCss("banner", { light: "a { color: #ff0000; }", dark: null });

    expect(css?.light).toMatch(/\.fb-creative-banner a/);
    expect(css?.dark).toBeUndefined();
  });

  test("loads nothing from third parties: @import, @font-face and external url() are stripped", async () => {
    const css = await compileCreativeCustomCss("feedbackButton", {
      light: [
        '@import url("https://fonts.example.com/font.css");',
        '@font-face { font-family: X; src: url("https://fonts.example.com/x.woff2"); }',
        '.fb-creative-button { background-image: url("https://tracker.example.com/pixel.png"); color: #ff0000; }',
      ].join("\n"),
      dark: null,
    });

    expect(css?.light).toContain("color");
    expect(css?.light).not.toMatch(/@import|@font-face|url\(|example\.com/);
  });

  test("withholds CSS the processor rejects", async () => {
    const css = await compileCreativeCustomCss("feedbackButton", {
      light: ".fb-creative-button { color: red; ".repeat(1) + "x".repeat(25_000),
      dark: null,
    });

    expect(css).toBeNull();
  });

  test("CSS that is only whitespace compiles to nothing", async () => {
    expect(await compileCreativeCustomCss("banner", { light: "   ", dark: "" })).toBeNull();
  });
});
