// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TWorkspaceStyling } from "@formbricks/types/workspace";
import { addCustomThemeToDom, getDarkThemeCss } from "./styles";

vi.mock("@/styles/global.css?inline", () => ({ default: "" }));
vi.mock("@/styles/preflight.css?inline", () => ({ default: "" }));
vi.mock("../../../../apps/web/modules/ui/components/editor/styles-editor-frontend.css?inline", () => ({
  default: "",
}));

/*
 * Theme values are written into stylesheet text (ENG-2950). Stored styling can predate write-time
 * validation, so the renderer drops unsafe legacy values and falls back as if they were unset, while
 * valid styling renders exactly as before.
 */

const render = (styling: Partial<TWorkspaceStyling>): string => {
  addCustomThemeToDom({ styling: { allowStyleOverwrite: true, ...styling } });
  return document.getElementById("formbricks__css__custom")?.innerHTML ?? "";
};

const TYPICAL: Partial<TWorkspaceStyling> = {
  brandColor: { light: "#1f5f8b", dark: "#7ab8e0" },
  cardBackgroundColor: { light: "#ffffff", dark: "#0c181e" },
  roundness: "12",
  buttonBorderRadius: "999px",
  buttonHeight: "2.75rem",
  buttonFontWeight: "600",
  inputPaddingX: 12.5,
  inputFontSize: "100%",
  inputShadow: "inset 0 0 0 1px rgba(16, 40, 58, 0.25), 0 1px 2px #0000000d",
  elementHeadlineFontWeight: 600,
  elementUpperLabelFontWeight: "bold",
  progressTrackHeight: "6",
};

describe("theme values in generated CSS", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  test("renders valid values verbatim", () => {
    const css = render(TYPICAL);
    expect(css).toContain("--fb-brand-color: #1f5f8b;");
    expect(css).toContain("--fb-border-radius: 12px;");
    expect(css).toContain("--fb-button-border-radius: 999px;");
    expect(css).toContain("--fb-button-height: 2.75rem;");
    expect(css).toContain("--fb-button-font-weight: 600;");
    expect(css).toContain("--fb-input-padding-x: 12.5px;");
    expect(css).toContain("--fb-input-font-size: 100%;");
    expect(css).toContain("--fb-input-shadow: inset 0 0 0 1px rgba(16, 40, 58, 0.25), 0 1px 2px #0000000d;");
    expect(css).toContain("--fb-element-upper-label-font-weight: bold;");
    expect(css).toContain("--fb-progress-track-height: 6px;");
    expect(css).toContain('#fbjs[data-appearance="dark"] {');
    expect(css).toContain("--fb-brand-color: #7ab8e0;");
  });

  test("falls back for unsafe legacy values instead of writing them", () => {
    const css = render({
      ...TYPICAL,
      brandColor: { light: "red; } body { display: none", dark: null },
      cardBackgroundColor: { light: "#ffffff", dark: "#000; background: url(https://evil.example/d)" },
      roundness: "8px; background: url(https://evil.example/r)",
      buttonBorderRadius: "1px } #fbjs { position: fixed",
      buttonFontWeight: "600; color: red",
      inputShadow: "0 0 red; background-image: url(https://evil.example/s)",
      progressTrackHeight: "8px</style><script>alert(1)</script>",
    } as Partial<TWorkspaceStyling>);

    expect(css).not.toMatch(/evil\.example|display: none|position: fixed|<\/style|<script|color: red/);
    // Each unsafe value behaves as if it were unset: the defaults apply and no override rule is emitted.
    expect(css).toContain("--fb-brand-text-color: #ffffff;");
    expect(css).toContain("--fb-border-radius: 8px;");
    expect(css).not.toContain("--fb-button-border-radius: 1px");
    expect(css).not.toContain("--fb-button-font-weight");
    expect(css).not.toContain("--fb-input-shadow: 0 0 red");
    expect(css).not.toContain("--fb-progress-track-height");
    // Valid neighbours still render.
    expect(css).toContain("--fb-button-height: 2.75rem;");
  });

  test("the dark palette ignores an unsafe dark override and derives the color instead", () => {
    const css = getDarkThemeCss({
      allowStyleOverwrite: true,
      brandColor: { light: "#1f5f8b" },
      cardBackgroundColor: { light: "#ffffff", dark: "#000;x:y" },
    } as TWorkspaceStyling);
    expect(css).not.toContain("x:y");
    expect(css).toMatch(/--fb-survey-background-color: #[0-9a-f]{6};/);
  });
});
