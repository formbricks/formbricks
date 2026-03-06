import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type TProjectStyling } from "@formbricks/types/project";
import { type TSurveyStyling } from "@formbricks/types/surveys/types";
import { addCustomThemeToDom, addStylesToDom, getStyleNonce, setStyleNonce } from "./styles";

// Mock CSS module imports
vi.mock("@/styles/global.css?inline", () => ({ default: ".global {}" }));
vi.mock("@/styles/preflight.css?inline", () => ({ default: ".preflight {}" }));
vi.mock("../../../../apps/web/modules/ui/components/editor/styles-editor-frontend.css?inline", () => ({
  default: ".editor {}",
}));

// Mock color utility functions if they have complex dependencies or for controlled testing
// For now, we assume they work as expected or are simple enough not to need mocking here.
// If isLight or mixColor had external dependencies or complex logic, you might mock them:
// vi.mock('@/lib/color', () => ({
//   isLight: vi.fn(),
//   mixColor: vi.fn(),
// }));

// Helper to create a base TProjectStyling object with all properties set to null or a default
const getBaseProjectStyling = (overrides: Partial<TProjectStyling> = {}): TProjectStyling => {
  return {
    brandColor: null,
    cardBackgroundColor: null,
    cardBorderColor: null,

    questionColor: null,
    inputColor: null,
    inputBorderColor: null,
    roundness: null, // defaults to 8 in addCustomThemeToDom if null here
    hideProgressBar: null,
    allowStyleOverwrite: false,
    highlightBorderColor: null,
    isLogoHidden: null,
    ...overrides,
  };
};

describe("setStyleNonce and getStyleNonce", () => {
  beforeEach(() => {
    // Reset the DOM and nonce before each test
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    setStyleNonce(undefined);
  });

  test("should set and get the nonce value", () => {
    const nonce = "test-nonce-123";
    setStyleNonce(nonce);
    expect(getStyleNonce()).toBe(nonce);
  });

  test("should allow clearing the nonce with undefined", () => {
    setStyleNonce("initial-nonce");
    expect(getStyleNonce()).toBe("initial-nonce");
    setStyleNonce(undefined);
    expect(getStyleNonce()).toBeUndefined();
  });

  test("should update existing formbricks__css element with nonce", () => {
    // Create an existing style element
    const existingElement = document.createElement("style");
    existingElement.id = "formbricks__css";
    document.head.appendChild(existingElement);

    const nonce = "test-nonce-456";
    setStyleNonce(nonce);

    expect(existingElement.getAttribute("nonce")).toBe(nonce);
  });

  test("should update existing formbricks__css__custom element with nonce", () => {
    // Create an existing custom style element
    const existingElement = document.createElement("style");
    existingElement.id = "formbricks__css__custom";
    document.head.appendChild(existingElement);

    const nonce = "test-nonce-789";
    setStyleNonce(nonce);

    expect(existingElement.getAttribute("nonce")).toBe(nonce);
  });

  test("should not update nonce on existing elements when nonce is undefined", () => {
    // Create existing style elements
    const mainElement = document.createElement("style");
    mainElement.id = "formbricks__css";
    mainElement.setAttribute("nonce", "existing-nonce");
    document.head.appendChild(mainElement);

    const customElement = document.createElement("style");
    customElement.id = "formbricks__css__custom";
    customElement.setAttribute("nonce", "existing-nonce");
    document.head.appendChild(customElement);

    setStyleNonce(undefined);

    // Elements should retain their existing nonce (or be cleared if implementation removes it)
    // The current implementation doesn't remove nonce when undefined, so we check it's not changed
    expect(mainElement.getAttribute("nonce")).toBe("existing-nonce");
    expect(customElement.getAttribute("nonce")).toBe("existing-nonce");
  });

  test("should handle setting nonce when elements don't exist", () => {
    const nonce = "test-nonce-no-elements";
    setStyleNonce(nonce);
    expect(getStyleNonce()).toBe(nonce);
    // Should not throw and should store the nonce for future use
  });
});

describe("addStylesToDom", () => {
  beforeEach(() => {
    // Reset the DOM before each test
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    setStyleNonce(undefined);
  });

  afterEach(() => {
    const styleElement = document.getElementById("formbricks__css");
    if (styleElement) {
      styleElement.remove();
    }
    setStyleNonce(undefined);
  });

  test("should add a style element to the head with combined CSS", () => {
    addStylesToDom();
    const styleElement = document.getElementById("formbricks__css") as HTMLStyleElement;
    expect(styleElement).not.toBeNull();
    expect(styleElement.tagName).toBe("STYLE");
    expect(document.head.contains(styleElement)).toBe(true);

    const expectedCss = ".preflight {}.global {}.editor {}";
    expect(styleElement.innerHTML).toBe(expectedCss);
  });

  test("should not add a new style element if one already exists", () => {
    addStylesToDom(); // First call
    const firstStyleElement = document.getElementById("formbricks__css");
    const initialInnerHTML = firstStyleElement?.innerHTML;

    addStylesToDom(); // Second call
    const secondStyleElement = document.getElementById("formbricks__css");
    const allStyleElements = document.querySelectorAll("#formbricks__css");

    expect(allStyleElements.length).toBe(1);
    expect(secondStyleElement).toBe(firstStyleElement);
    expect(secondStyleElement?.innerHTML).toBe(initialInnerHTML);
  });

  test("should apply nonce to new style element when nonce is set", () => {
    const nonce = "test-nonce-styles";
    setStyleNonce(nonce);
    addStylesToDom();

    const styleElement = document.getElementById("formbricks__css") as HTMLStyleElement;
    expect(styleElement).not.toBeNull();
    expect(styleElement.getAttribute("nonce")).toBe(nonce);
  });

  test("should not apply nonce when nonce is not set", () => {
    addStylesToDom();
    const styleElement = document.getElementById("formbricks__css") as HTMLStyleElement;
    expect(styleElement).not.toBeNull();
    expect(styleElement.getAttribute("nonce")).toBeNull();
  });

  test("should update nonce on existing style element if nonce is set after creation", () => {
    addStylesToDom(); // Create element without nonce
    const styleElement = document.getElementById("formbricks__css") as HTMLStyleElement;
    expect(styleElement.getAttribute("nonce")).toBeNull();

    const nonce = "test-nonce-update";
    setStyleNonce(nonce);
    addStylesToDom(); // Call again to trigger update logic

    expect(styleElement.getAttribute("nonce")).toBe(nonce);
  });

  test("should not overwrite existing nonce when updating via addStylesToDom", () => {
    const existingElement = document.createElement("style");
    existingElement.id = "formbricks__css";
    existingElement.setAttribute("nonce", "existing-nonce");
    document.head.appendChild(existingElement);

    // Don't call setStyleNonce - just verify addStylesToDom doesn't overwrite
    addStylesToDom(); // Should not overwrite since nonce already exists

    // The update logic in addStylesToDom only sets nonce if it doesn't exist
    expect(existingElement.getAttribute("nonce")).toBe("existing-nonce");
  });

  test("should overwrite existing nonce when setStyleNonce is called directly", () => {
    const existingElement = document.createElement("style");
    existingElement.id = "formbricks__css";
    existingElement.setAttribute("nonce", "existing-nonce");
    document.head.appendChild(existingElement);

    const newNonce = "new-nonce";
    setStyleNonce(newNonce); // setStyleNonce always updates existing elements

    // setStyleNonce directly updates the nonce attribute
    expect(existingElement.getAttribute("nonce")).toBe(newNonce);
  });
});

describe("addCustomThemeToDom", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    setStyleNonce(undefined);
  });

  afterEach(() => {
    const styleElement = document.getElementById("formbricks__css__custom");
    if (styleElement) {
      styleElement.remove();
    }
    setStyleNonce(undefined);
  });

  const getCssVariables = (styleElement: HTMLStyleElement | null): Record<string, string> => {
    if (!styleElement || !styleElement.innerHTML) return {};
    const cssText = styleElement.innerHTML;
    const rootMatch = cssText.match(/#fbjs\s*{\s*([^}]*?)\s*}/);
    if (!rootMatch || !rootMatch[1]) return {};

    const variables: Record<string, string> = {};
    const lines = rootMatch[1]
      .trim()
      .split(";")
      .filter((line) => line.trim() !== "");
    lines.forEach((line) => {
      const parts = line.split(":");
      if (parts.length === 2) {
        variables[parts[0].trim()] = parts[1].trim();
      }
    });
    return variables;
  };

  test("should add a custom theme style element to the head", () => {
    const styling = getBaseProjectStyling({ brandColor: { light: "#FF0000" } });
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    expect(styleElement).not.toBeNull();
    expect(styleElement.tagName).toBe("STYLE");
    expect(document.head.contains(styleElement)).toBe(true);
  });

  test("should reuse existing custom theme style element", () => {
    const styling1 = getBaseProjectStyling({ brandColor: { light: "#FF0000" } });
    addCustomThemeToDom({ styling: styling1 });
    const firstElement = document.getElementById("formbricks__css__custom");

    const styling2 = getBaseProjectStyling({ brandColor: { light: "#00FF00" } });
    addCustomThemeToDom({ styling: styling2 });
    const secondElement = document.getElementById("formbricks__css__custom");
    const allElements = document.querySelectorAll("#formbricks__css__custom");

    expect(allElements.length).toBe(1);
    expect(secondElement).toBe(firstElement);
  });

  test("should apply minimal styling with brandColor and default roundness", () => {
    const styling = getBaseProjectStyling({ brandColor: { light: "#0000FF" } }); // A dark color, roundness will use default
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);

    expect(variables["--fb-brand-color"]).toBe("#0000FF");
    expect(variables["--fb-focus-color"]).toBe("#0000FF");
    expect(variables["--fb-brand-text-color"]).toBe("white"); // isLight('#0000FF') is false
    expect(variables["--fb-border-radius"]).toBe("8px"); // Default roundness
  });

  test("should apply brand-text-color as black for light brandColor", () => {
    const styling = getBaseProjectStyling({ brandColor: { light: "#FFFF00" } }); // A light color
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);
    expect(variables["--fb-brand-text-color"]).toBe("black"); // isLight('#FFFF00') is true
  });

  test("should default brand-text-color to white if brandColor is undefined", () => {
    const styling = getBaseProjectStyling({ brandColor: null }); // Explicitly null brandColor
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);
    expect(variables["--fb-brand-text-color"]).toBe("#ffffff");
  });

  test("should apply all survey styling properties", () => {
    const styling: TSurveyStyling = {
      brandColor: { light: "#112233" },
      questionColor: { light: "#AABBCC" },
      inputBorderColor: { light: "#DDDDDD" },
      cardBackgroundColor: { light: "#EEEEEE" },
      cardBorderColor: { light: "#CCCCCC" },

      inputColor: { light: "#F0F0F0" },
      roundness: 12,
      hideProgressBar: false,
      background: { bg: "#ABCDEF", bgType: "color", brightness: 100 },
      highlightBorderColor: { light: "#990000" },
      overwriteThemeStyling: false,
    };
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);

    expect(variables["--fb-brand-color"]).toBe("#112233");
    expect(variables["--fb-focus-color"]).toBe("#112233");
    expect(variables["--fb-brand-text-color"]).toBe("white");
    expect(variables["--fb-heading-color"]).toBe("#AABBCC");
    expect(variables["--fb-subheading-color"]).toBe("#AABBCC");
    expect(variables["--fb-placeholder-color"]).toBeDefined(); // Relies on mixColor
    expect(variables["--fb-border-color"]).toBe("#DDDDDD");
    expect(variables["--fb-border-color-highlight"]).toBeDefined(); // Relies on mixColor
    expect(variables["--fb-survey-background-color"]).toBe("#EEEEEE");
    expect(variables["--fb-survey-border-color"]).toBe("#CCCCCC");
    expect(variables["--fb-border-radius"]).toBe("12px");
    expect(variables["--fb-input-background-color"]).toBe("#F0F0F0");
    expect(variables["--fb-signature-text-color"]).toBeDefined(); // Relies on mixColor & isLight
    expect(variables["--fb-branding-text-color"]).toBeDefined(); // Relies on mixColor & isLight
    expect(variables["--fb-input-background-color-selected"]).toBeDefined(); // Relies on mixColor

    // Check accent colors derived from brandColor when not explicitly set
    expect(variables["--fb-accent-background-color"]).toBeDefined();
    expect(variables["--fb-accent-background-color-selected"]).toBeDefined();

    // calendar-tile-color depends on isLight(brandColor)
    expect(variables["--fb-calendar-tile-color"]).toBeUndefined(); // isLight('#112233') is false, so this should be undefined
  });

  test("should generate calendar-tile-color for light brandColor", () => {
    const styling = getBaseProjectStyling({ brandColor: { light: "#ffffff" } });
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);

    expect(variables["--fb-calendar-tile-color"]).toBeDefined();
  });

  test("should apply advanced styling properties", () => {
    const styling: TSurveyStyling = {
      ...getBaseProjectStyling(),
      // Buttons
      buttonBgColor: { light: "#btn-bg" },
      buttonTextColor: { light: "#btn-text" },
      buttonBorderRadius: 4,
      buttonHeight: "40",
      buttonFontSize: 16,
      buttonFontWeight: "bold",
      buttonPaddingX: 20,
      buttonPaddingY: 10,
      // Inputs
      inputTextColor: { light: "#input-text" },
      inputBorderRadius: 4,
      inputHeight: 40,
      inputFontSize: 14,
      inputPaddingX: 12,
      inputPaddingY: 8,
      inputPlaceholderOpacity: 0.5,
      inputShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      // Options
      optionBgColor: { light: "#option-bg" },
      optionLabelColor: { light: "#option-label" },
      optionBorderColor: { light: "#option-border" },
      optionBorderRadius: 4,
      optionPaddingX: 12,
      optionPaddingY: 8,
      optionFontSize: 14,
      // Element Headline & Description
      elementHeadlineFontSize: 24,
      elementHeadlineFontWeight: "bold",
      elementHeadlineColor: { light: "#headline-color" },
      elementDescriptionFontSize: 16,
      elementDescriptionColor: { light: "#desc-color" },
      // Progress Bar
      progressTrackHeight: 4,
      progressTrackBgColor: { light: "#track-bg" },
      progressIndicatorBgColor: { light: "#indicator-bg" },
    };

    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);

    // Buttons
    expect(variables["--fb-button-bg-color"]).toBe("#btn-bg");
    expect(variables["--fb-button-text-color"]).toBe("#btn-text");
    expect(variables["--fb-button-border-radius"]).toBe("4px");
    expect(variables["--fb-button-height"]).toBe("40px");
    expect(variables["--fb-button-font-size"]).toBe("16px");
    expect(variables["--fb-button-font-weight"]).toBe("bold");
    expect(variables["--fb-button-padding-x"]).toBe("20px");
    expect(variables["--fb-button-padding-y"]).toBe("10px");
    // Inputs
    expect(variables["--fb-input-text-color"]).toBe("#input-text");
    expect(variables["--fb-input-border-radius"]).toBe("4px");
    expect(variables["--fb-input-height"]).toBe("40px");
    expect(variables["--fb-input-font-size"]).toBe("14px");
    expect(variables["--fb-input-padding-x"]).toBe("12px");
    expect(variables["--fb-input-padding-y"]).toBe("8px");
    expect(variables["--fb-input-placeholder-opacity"]).toBe("0.5");
    expect(variables["--fb-input-shadow"]).toBe("0 1px 2px 0 rgba(0, 0, 0, 0.05)");
    // Options
    expect(variables["--fb-option-bg-color"]).toBe("#option-bg");
    expect(variables["--fb-option-label-color"]).toBe("#option-label");
    expect(variables["--fb-option-border-color"]).toBe("#option-border");
    expect(variables["--fb-option-border-radius"]).toBe("4px");
    expect(variables["--fb-option-padding-x"]).toBe("12px");
    expect(variables["--fb-option-padding-y"]).toBe("8px");
    expect(variables["--fb-option-font-size"]).toBe("14px");
    // Element Headline & Description
    expect(variables["--fb-element-headline-font-size"]).toBe("24px");
    expect(variables["--fb-element-headline-font-weight"]).toBe("bold");
    expect(variables["--fb-element-headline-color"]).toBe("#headline-color");
    expect(variables["--fb-element-description-font-size"]).toBe("16px");
    expect(variables["--fb-element-description-color"]).toBe("#desc-color");
    // Progress Bar
    expect(variables["--fb-progress-track-height"]).toBe("4px");
    expect(variables["--fb-progress-track-bg-color"]).toBe("#track-bg");
    expect(variables["--fb-progress-indicator-bg-color"]).toBe("#indicator-bg");
  });

  test("should format dimensions correctly", () => {
    const styling: TSurveyStyling = {
      ...getBaseProjectStyling(),
      buttonBorderRadius: 10, // number -> px
      buttonHeight: "20", // numeric string -> px
      buttonFontSize: "1.5rem", // string -> string
    };

    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);

    expect(variables["--fb-button-border-radius"]).toBe("10px");
    expect(variables["--fb-button-height"]).toBe("20px");
    expect(variables["--fb-button-font-size"]).toBe("1.5rem");
  });

  test("should derive input-placeholder-color from inputTextColor when set", () => {
    const styling: TSurveyStyling = {
      ...getBaseProjectStyling(),
      questionColor: { light: "#AABBCC" },
      inputTextColor: { light: "#112233" },
    };
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);

    // Placeholder should be derived from inputTextColor, not questionColor
    expect(variables["--fb-input-placeholder-color"]).toBeDefined();
    expect(variables["--fb-placeholder-color"]).toBeDefined();
    // Both should be based on inputTextColor (#112233) mixed with white, not questionColor (#AABBCC)
    // We can verify by checking the placeholder color doesn't contain the questionColor mix
    expect(variables["--fb-input-placeholder-color"]).toBe(variables["--fb-placeholder-color"]);
  });

  test("should derive input-placeholder-color from questionColor when inputTextColor is not set", () => {
    const styling: TSurveyStyling = {
      ...getBaseProjectStyling(),
      questionColor: { light: "#AABBCC" },
    };
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);

    // Placeholder should fall back to questionColor when inputTextColor is not set
    expect(variables["--fb-input-placeholder-color"]).toBeDefined();
    expect(variables["--fb-placeholder-color"]).toBeDefined();
    expect(variables["--fb-input-placeholder-color"]).toBe(variables["--fb-placeholder-color"]);
  });

  test("should set signature and branding text colors for dark questionColor", () => {
    const styling = getBaseProjectStyling({
      questionColor: { light: "#202020" }, // A dark color
      brandColor: { light: "#123456" }, // brandColor needed for some default fallbacks if not directly testing them
    });
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);

    // For dark questionColor ('#202020'), isLight is false, so mix with white.
    expect(variables["--fb-signature-text-color"]).toBeDefined();
    expect(variables["--fb-branding-text-color"]).toBeDefined();
  });

  test("should handle roundness 0 correctly", () => {
    const styling = getBaseProjectStyling({ roundness: 0, brandColor: { light: "#123456" } });
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);
    expect(variables["--fb-border-radius"]).toBe("0px");
  });

  test("should set input-background-color-selected to slate-50 for white inputColor", () => {
    const whiteColors = ["#fff", "#ffffff", "white"];
    whiteColors.forEach((color) => {
      const styling = getBaseProjectStyling({ inputColor: { light: color }, brandColor: { light: "#123" } });
      addCustomThemeToDom({ styling });
      const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
      const variables = getCssVariables(styleElement);
      expect(variables["--fb-input-background-color-selected"]).toBe("var(--slate-50)");
    });
  });

  test("should mix input-background-color-selected for non-white inputColor", () => {
    const styling = getBaseProjectStyling({
      inputColor: { light: "#E0E0E0" },
      brandColor: { light: "#123" },
    }); // Not white
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);
    // We can't easily test the exact mixed color without duplicating mixColor logic or having access to its exact output for these inputs.
    // So, we just check that it's defined and not the slate-50 default.
    expect(variables["--fb-input-background-color-selected"]).toBeDefined();
    expect(variables["--fb-input-background-color-selected"]).not.toBe("var(--slate-50)");
  });

  test("should not set calendar-tile-color if brandColor is undefined", () => {
    const styling = getBaseProjectStyling({ brandColor: null });
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);
    expect(variables["--fb-calendar-tile-color"]).toBeUndefined();
  });

  test("should not define variables for undefined styling properties", () => {
    const styling = getBaseProjectStyling({ brandColor: { light: "#ABC" } }); // Only brandColor is defined
    addCustomThemeToDom({ styling });
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    const variables = getCssVariables(styleElement);

    expect(variables["--fb-brand-color"]).toBe("#ABC");
    // Check a few that would not be set
    expect(variables["--fb-heading-color"]).toBeUndefined();
    expect(variables["--fb-survey-background-color"]).toBeUndefined();
    expect(variables["--fb-input-background-color"]).toBeUndefined();
  });

  test("should apply nonce to new custom theme style element when nonce is set", () => {
    const nonce = "test-nonce-custom";
    setStyleNonce(nonce);
    const styling = getBaseProjectStyling({ brandColor: { light: "#FF0000" } });
    addCustomThemeToDom({ styling });

    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    expect(styleElement).not.toBeNull();
    expect(styleElement.getAttribute("nonce")).toBe(nonce);
  });

  test("should not apply nonce when nonce is not set", () => {
    const styling = getBaseProjectStyling({ brandColor: { light: "#FF0000" } });
    addCustomThemeToDom({ styling });

    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    expect(styleElement).not.toBeNull();
    expect(styleElement.getAttribute("nonce")).toBeNull();
  });

  test("should update nonce on existing custom style element if nonce is set after creation", () => {
    const styling = getBaseProjectStyling({ brandColor: { light: "#FF0000" } });
    addCustomThemeToDom({ styling }); // Create element without nonce
    const styleElement = document.getElementById("formbricks__css__custom") as HTMLStyleElement;
    expect(styleElement.getAttribute("nonce")).toBeNull();

    const nonce = "test-nonce-custom-update";
    setStyleNonce(nonce);
    addCustomThemeToDom({ styling }); // Call again to trigger update logic

    expect(styleElement.getAttribute("nonce")).toBe(nonce);
  });

  test("should not overwrite existing nonce when updating custom theme via addCustomThemeToDom", () => {
    const existingElement = document.createElement("style");
    existingElement.id = "formbricks__css__custom";
    existingElement.setAttribute("nonce", "existing-custom-nonce");
    document.head.appendChild(existingElement);

    // Don't call setStyleNonce - just verify addCustomThemeToDom doesn't overwrite
    const styling = getBaseProjectStyling({ brandColor: { light: "#FF0000" } });
    addCustomThemeToDom({ styling }); // Should not overwrite since nonce already exists

    // The update logic in addCustomThemeToDom only sets nonce if it doesn't exist
    expect(existingElement.getAttribute("nonce")).toBe("existing-custom-nonce");
  });

  test("should overwrite existing nonce when setStyleNonce is called directly on custom theme", () => {
    const existingElement = document.createElement("style");
    existingElement.id = "formbricks__css__custom";
    existingElement.setAttribute("nonce", "existing-custom-nonce");
    document.head.appendChild(existingElement);

    const newNonce = "new-custom-nonce";
    setStyleNonce(newNonce); // setStyleNonce directly updates the nonce attribute

    // setStyleNonce directly updates the nonce attribute
    expect(existingElement.getAttribute("nonce")).toBe(newNonce);
  });
});

describe("getBaseProjectStyling_Helper", () => {
  test("should return default values for all properties when no overrides are provided", () => {
    const baseStyling = getBaseProjectStyling();
    expect(baseStyling.brandColor).toBeNull();
    expect(baseStyling.cardBackgroundColor).toBeNull();
    expect(baseStyling.cardBorderColor).toBeNull();

    expect(baseStyling.questionColor).toBeNull();
    // Specifically testing lines highlighted by user
    expect(baseStyling.inputColor).toBeNull();
    expect(baseStyling.inputBorderColor).toBeNull();
    expect(baseStyling.roundness).toBeNull();
    expect(baseStyling.hideProgressBar).toBeNull();
    expect(baseStyling.allowStyleOverwrite).toBe(false);
    expect(baseStyling.highlightBorderColor).toBeNull();
    // End of user highlighted lines
    expect(baseStyling.isLogoHidden).toBeNull();
  });

  test("should correctly apply overrides to specified properties", () => {
    const overrides: Partial<TProjectStyling> = {
      inputColor: { light: "#111" },
      inputBorderColor: { light: "#222" },
      roundness: 10,
      hideProgressBar: true,
      allowStyleOverwrite: true,
      highlightBorderColor: { light: "#333" },
      brandColor: { light: "#FFF" }, // Also test a non-highlighted property
    };
    const styled = getBaseProjectStyling(overrides);

    expect(styled.inputColor).toEqual({ light: "#111" });
    expect(styled.inputBorderColor).toEqual({ light: "#222" });
    expect(styled.roundness).toBe(10);
    expect(styled.hideProgressBar).toBe(true);
    expect(styled.allowStyleOverwrite).toBe(true);
    expect(styled.highlightBorderColor).toEqual({ light: "#333" });
    expect(styled.brandColor).toEqual({ light: "#FFF" });

    // Check a property not in overrides retains its default
    expect(styled.cardBackgroundColor).toBeNull();
    expect(styled.isLogoHidden).toBeNull();
  });
});
