import { describe, expect, test } from "vitest";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { getContrastRatio, mixColor } from "@/lib/utils/colors";
import { FOOTER_MEDIA_BACKDROP, getFooterLinkStyle } from "./footer-link-color";

const AA = 4.5;

// Minimal styling stub carrying only the background field the helper reads.
const withBackground = (background: TSurveyStyling["background"]): TSurveyStyling =>
  ({ background }) as TSurveyStyling;

describe("getFooterLinkStyle", () => {
  test("default light-blue background → subtle dark text, AA compliant, no backdrop", () => {
    const surface = "#dee3f3"; // mixColor("#1e40af", "#ffffff", 0.855), the default page bg
    const { textColor, backdropColor } = getFooterLinkStyle(
      withBackground({ bg: surface, bgType: "color", brightness: 100 })
    );

    expect(textColor).toBe("#334155"); // slate-700
    expect(backdropColor).toBeUndefined();
    expect(getContrastRatio(textColor, surface)).toBeGreaterThanOrEqual(AA);
  });

  test("dark solid background → light text, AA compliant", () => {
    const surface = "#0f172a";
    const { textColor } = getFooterLinkStyle(
      withBackground({ bg: surface, bgType: "color", brightness: 100 })
    );

    expect(textColor).toBe("#f1f5f9"); // slate-100
    expect(getContrastRatio(textColor, surface)).toBeGreaterThanOrEqual(AA);
  });

  test("mid-tone gray background → escalates to a compliant strong tone", () => {
    const surface = "#808080"; // neither subtle tone reaches 4.5:1 here
    const { textColor } = getFooterLinkStyle(
      withBackground({ bg: surface, bgType: "color", brightness: 100 })
    );

    expect(["#0f172a", "#ffffff"]).toContain(textColor);
    expect(getContrastRatio(textColor, surface)).toBeGreaterThanOrEqual(AA);
  });

  test("brightness filter is accounted for when resolving the surface", () => {
    const bg = "#dee3f3";
    const { textColor } = getFooterLinkStyle(withBackground({ bg, bgType: "color", brightness: 20 }));

    // brightness(20%) ≈ mixing the color 80% toward black -> a dark surface.
    const effectiveSurface = mixColor(bg, "#000000", 0.8);
    expect(getContrastRatio(textColor, effectiveSurface)).toBeGreaterThanOrEqual(AA);
  });

  test.each(["image", "animation", "upload"] as const)(
    "%s background → near-white backdrop + AA-compliant dark text",
    (bgType) => {
      const { textColor, backdropColor } = getFooterLinkStyle(
        withBackground({ bg: "https://example.com/bg", bgType, brightness: 100 })
      );

      expect(backdropColor).toBe(FOOTER_MEDIA_BACKDROP);
      expect(getContrastRatio(textColor, "#ffffff")).toBeGreaterThanOrEqual(AA);
    }
  );

  test("missing background → treated as media (backdrop + compliant text)", () => {
    const { textColor, backdropColor } = getFooterLinkStyle(withBackground(undefined));

    expect(backdropColor).toBe(FOOTER_MEDIA_BACKDROP);
    expect(getContrastRatio(textColor, "#ffffff")).toBeGreaterThanOrEqual(AA);
  });
});
