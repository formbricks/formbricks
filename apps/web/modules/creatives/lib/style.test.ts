import { describe, expect, test } from "vitest";
import type { BannerThemeZodType, FeedbackButtonThemeZodType } from "@formbricks/api-v3-schemas";
import type { TWorkspaceStyling } from "@formbricks/types/workspace";
import { DEFAULT_CREATIVE_STYLING } from "./creative";
import { type TCreativeStyleSource, getAppliedCustomCssSource, getCreativeStyle } from "./style";

const WORKSPACE: TWorkspaceStyling = {
  allowStyleOverwrite: true,
  brandColor: { light: "#0b5394" },
  buttonBgColor: { light: "#0b5394" },
  buttonTextColor: { light: "#ffffff" },
  buttonBorderRadius: 4,
  buttonFontSize: 15,
  buttonFontWeight: 600,
  buttonPaddingX: 20,
  buttonPaddingY: 10,
  cardBackgroundColor: { light: "#fafafa" },
  cardBorderColor: { light: "#cccccc" },
  elementHeadlineColor: { light: "#222222" },
  elementHeadlineFontSize: 17,
  elementHeadlineFontWeight: 500,
};

const buttonTheme: FeedbackButtonThemeZodType = DEFAULT_CREATIVE_STYLING.feedbackButton.theme;
const bannerTheme: BannerThemeZodType = DEFAULT_CREATIVE_STYLING.banner.theme;

const feedbackButton = (theme: Partial<FeedbackButtonThemeZodType> = {}): TCreativeStyleSource => ({
  type: "feedbackButton",
  styling: { theme: { ...buttonTheme, ...theme } },
});

const banner = (theme: Partial<BannerThemeZodType> = {}): TCreativeStyleSource => ({
  type: "banner",
  styling: { theme: { ...bannerTheme, ...theme } },
});

describe("getCreativeStyle", () => {
  describe("without custom styles", () => {
    test("a feedback button looks like the workspace's survey Next button", () => {
      const { element, button } = getCreativeStyle(feedbackButton(), WORKSPACE);

      expect(element.light).toEqual({ backgroundColor: "#0b5394", textColor: "#ffffff", borderColor: null });
      expect(element.desktop).toEqual({ fontSize: 15, paddingX: 20, paddingY: 10 });
      expect(element.phone).toEqual(element.desktop);
      expect(element.borderRadius).toBe(4);
      expect(element.fontWeight).toBe(600);
      expect(button).toBeNull();
    });

    test("a token the workspace never set uses the Look & Feel default", () => {
      const { element } = getCreativeStyle(feedbackButton(), { allowStyleOverwrite: true });

      expect(element.light).toEqual({ backgroundColor: "#1e40af", textColor: "#ffffff", borderColor: null });
      expect(element.desktop).toEqual({ fontSize: 16, paddingX: 12, paddingY: 12 });
      expect(element.borderRadius).toBe(8);
      expect(element.fontWeight).toBe(500);
    });

    test("reads stored dimensions as px and ignores values it can't draw", () => {
      const { element } = getCreativeStyle(feedbackButton(), {
        allowStyleOverwrite: true,
        buttonFontSize: "18px",
        buttonPaddingX: "14",
        buttonPaddingY: "1rem",
        buttonFontWeight: "bold",
        buttonBgColor: { light: "red;} body{display:none" },
      });

      expect(element.desktop).toEqual({ fontSize: 18, paddingX: 14, paddingY: 12 });
      expect(element.fontWeight).toBe(700);
      expect(element.light.backgroundColor).toBe("#1e40af");
    });

    test("a button colour without a text colour gets readable text, as in the survey", () => {
      const { element } = getCreativeStyle(feedbackButton(), {
        allowStyleOverwrite: true,
        buttonBgColor: { light: "#fde047" },
      });

      expect(element.light.textColor).toBe("#0f172a");
    });

    test("a banner looks like the workspace's survey card, with the survey button inside", () => {
      const { element, button } = getCreativeStyle(banner(), WORKSPACE);

      expect(element.light).toEqual({
        backgroundColor: "#fafafa",
        textColor: "#222222",
        borderColor: "#cccccc",
      });
      expect(element.desktop.fontSize).toBe(17);
      expect(element.borderRadius).toBe(0);
      expect(button?.light).toEqual({ backgroundColor: "#0b5394", textColor: "#ffffff", borderColor: null });
      expect(button?.desktop).toEqual({ fontSize: 15, paddingX: 20, paddingY: 10 });
    });

    test("ignores the custom style values while the switch is off", () => {
      const { element } = getCreativeStyle(
        feedbackButton({ customStyles: false, backgroundColor: "#ff0000", borderRadius: 20 }),
        WORKSPACE
      );

      expect(element.light.backgroundColor).toBe("#0b5394");
      expect(element.borderRadius).toBe(4);
    });
  });

  describe("dark appearance", () => {
    test("a feedback button keeps the workspace's button colours, as the survey does", () => {
      const { element } = getCreativeStyle(feedbackButton(), WORKSPACE);

      expect(element.dark).toEqual(element.light);
    });

    test("uses the dark button colours the workspace set", () => {
      const { element } = getCreativeStyle(feedbackButton(), {
        ...WORKSPACE,
        buttonBgColor: { light: "#0b5394", dark: "#93c5fd" },
        buttonTextColor: { light: "#ffffff", dark: "#0f172a" },
      });

      expect(element.dark).toEqual({ backgroundColor: "#93c5fd", textColor: "#0f172a", borderColor: null });
    });

    test("a banner takes the survey card's dark colours", () => {
      const { element } = getCreativeStyle(banner(), {
        ...WORKSPACE,
        cardBackgroundColor: { light: "#fafafa", dark: "#111827" },
        cardBorderColor: { light: "#cccccc", dark: "#374151" },
        elementHeadlineColor: { light: "#222222", dark: "#f9fafb" },
      });

      expect(element.dark).toEqual({
        backgroundColor: "#111827",
        textColor: "#f9fafb",
        borderColor: "#374151",
      });
    });

    test("derives the banner's dark colours from the brand when the workspace set none", () => {
      const { element } = getCreativeStyle(banner(), WORKSPACE);

      expect(element.dark.backgroundColor).not.toBe(element.light.backgroundColor);
      expect(element.dark.textColor).not.toBe(element.light.textColor);
    });
  });

  describe("with custom styles", () => {
    test("overrides colours, shape and size field by field", () => {
      const { element } = getCreativeStyle(
        feedbackButton({
          customStyles: true,
          borderColor: "#000000",
          borderRadius: 0,
          fontWeight: 700,
          fontSize: { desktop: 18, phone: null },
          paddingX: { desktop: null, phone: 8 },
          paddingY: { desktop: 6, phone: 4 },
        }),
        WORKSPACE
      );

      expect(element.light).toEqual({
        backgroundColor: "#0b5394",
        textColor: "#ffffff",
        borderColor: "#000000",
      });
      expect(element.borderRadius).toBe(0);
      expect(element.fontWeight).toBe(700);
      expect(element.desktop).toEqual({ fontSize: 18, paddingX: 20, paddingY: 6 });
      expect(element.phone).toEqual({ fontSize: 18, paddingX: 8, paddingY: 4 });
    });

    test("a background without a text colour gets readable text", () => {
      const { element } = getCreativeStyle(
        banner({ customStyles: true, backgroundColor: "#7f1d1d" }),
        WORKSPACE
      );

      expect(element.light.textColor).toBe("#ffffff");
    });

    test("a background or text colour the author set keeps its pair in dark", () => {
      const { element } = getCreativeStyle(
        banner({ customStyles: true, backgroundColor: "#fef3c7", textColor: "#78350f" }),
        { ...WORKSPACE, cardBackgroundColor: { light: "#fafafa", dark: "#111827" } }
      );

      expect(element.dark.backgroundColor).toBe("#fef3c7");
      expect(element.dark.textColor).toBe("#78350f");
    });

    test("a border colour the author set applies in dark too, while untouched colours follow the dark card", () => {
      const { element } = getCreativeStyle(banner({ customStyles: true, borderColor: "#b91c1c" }), {
        ...WORKSPACE,
        cardBackgroundColor: { light: "#fafafa", dark: "#111827" },
      });

      expect(element.dark).toEqual(
        expect.objectContaining({ backgroundColor: "#111827", borderColor: "#b91c1c" })
      );
    });

    test("never restyles the banner's button", () => {
      const { button } = getCreativeStyle(
        banner({ customStyles: true, backgroundColor: "#000000", fontSize: { desktop: 30, phone: null } }),
        WORKSPACE
      );

      expect(button?.light.backgroundColor).toBe("#0b5394");
      expect(button?.desktop.fontSize).toBe(15);
    });
  });

  describe("page font", () => {
    test("follows the workspace setting, which is off when absent", () => {
      expect(getCreativeStyle(feedbackButton(), { ...WORKSPACE, pageFont: true }).pageFont).toBe(true);
      expect(getCreativeStyle(feedbackButton(), WORKSPACE).pageFont).toBe(false);
    });

    test("a creative's custom styles override the workspace setting", () => {
      const pageFontOff = feedbackButton({ customStyles: true, pageFont: false });
      const pageFontOn = banner({ customStyles: true, pageFont: true });

      expect(getCreativeStyle(pageFontOff, { ...WORKSPACE, pageFont: true }).pageFont).toBe(false);
      expect(getCreativeStyle(pageFontOn, WORKSPACE).pageFont).toBe(true);
      expect(
        getCreativeStyle(feedbackButton({ pageFont: false }), { ...WORKSPACE, pageFont: true }).pageFont
      ).toBe(true);
    });
  });

  describe("custom CSS", () => {
    const compiled = { light: "@layer fb-survey{.fb-creative-button{color:red!important}}" };

    test("applies the creative's compiled CSS only while its custom styles are on", () => {
      expect(getCreativeStyle(feedbackButton({ customStyles: true }), WORKSPACE, compiled).customCss).toEqual(
        compiled
      );
      expect(getCreativeStyle(feedbackButton(), WORKSPACE, compiled).customCss).toBeNull();
    });

    test("only CSS with content counts as applied source", () => {
      const css = { light: ".x{color:red}", dark: null };

      expect(getAppliedCustomCssSource({ ...buttonTheme, customStyles: true, customCss: css })).toEqual(css);
      expect(getAppliedCustomCssSource({ ...buttonTheme, customStyles: false, customCss: css })).toBeNull();
      expect(
        getAppliedCustomCssSource({
          ...bannerTheme,
          customStyles: true,
          customCss: { light: "  ", dark: "" },
        })
      ).toBeNull();
    });
  });
});
