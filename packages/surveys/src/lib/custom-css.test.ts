// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from "vitest";
import { applyCustomCss } from "./custom-css";

vi.mock("./styles", () => ({ getStyleNonce: () => "test-nonce" }));

describe("customer CSS insertion", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });
  test("keeps workspace and survey layers independent with a CSP nonce", () => {
    applyCustomCss({
      workspace: {
        light: "#fbjs{color:red!important}",
        dark: '#fbjs[data-appearance="dark"]{color:white!important}',
      },
      survey: { light: "#fbjs button{border-radius:99px!important}" },
    });
    const style = document.getElementById("formbricks__css__customer");
    expect(style?.getAttribute("nonce")).toBe("test-nonce");
    expect(style?.textContent).toContain("@layer fb-workspace {");
    expect(style?.textContent).toContain("@layer fb-workspace-dark {");
    expect(style?.textContent).toContain("@layer fb-survey {");
  });
  test("replaces the previous survey CSS and removes it when the next survey has none", () => {
    applyCustomCss({ survey: { light: "#fbjs{color:red}" } });
    applyCustomCss({ survey: { light: "#fbjs{color:blue}" } });
    expect(document.querySelectorAll("#formbricks__css__customer")).toHaveLength(1);
    expect(document.getElementById("formbricks__css__customer")?.textContent).not.toContain("red");
    applyCustomCss(undefined);
    expect(document.getElementById("formbricks__css__customer")).toBeNull();
  });
});
