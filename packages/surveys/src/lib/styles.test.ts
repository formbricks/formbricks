import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type TProjectStyling } from "@formbricks/types/project";
import { type TSurveyStyling } from "@formbricks/types/surveys/types";
import { addCustomThemeToDom, addStylesToDom } from "./styles";

// Mock CSS module imports
vi.mock("@/styles/global.css?inline", () => ({ default: ".global {}" }));
vi.mock("@/styles/preflight.css?inline", () => ({ default: ".preflight {}" }));
vi.mock("react-calendar/dist/Calendar.css?inline", () => ({ default: ".calendar {}" }));
vi.mock("react-date-picker/dist/DatePicker.css?inline", () => ({ default: ".datePicker {}" }));
vi.mock("../../../../apps/web/modules/ui/components/editor/styles-editor-frontend.css?inline", () => ({
  default: ".editor {}",
}));
vi.mock("../styles/date-picker.css?inline", () => ({ default: ".datePickerCustom {}" }));

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
    cardShadowColor: null,
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

describe("addStylesToDom", () => {
  beforeEach(() => {
    // Reset the DOM before each test
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    const styleElement = document.getElementById("formbricks__css");
    if (styleElement) {
      styleElement.remove();
    }
  });

  test("should add a style element to the head with combined CSS", () => {
    addStylesToDom();
    const styleElement = document.getElementById("formbricks__css") as HTMLStyleElement;
    expect(styleElement).not.toBeNull();
    expect(styleElement.tagName).toBe("STYLE");
    expect(document.head.contains(styleElement)).toBe(true);

    const expectedCss = ".preflight {}.global {}.editor {}.datePicker {}.calendar {}.datePickerCustom {}";
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
});

describe("addCustomThemeToDom", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  afterEach(() => {
    const styleElement = document.getElementById("formbricks__css__custom");
    if (styleElement) {
      styleElement.remove();
    }
  });

  const getCssVariables = (styleElement: HTMLStyleElement | null): Record<string, string> => {
    if (!styleElement || !styleElement.innerHTML) return {};
    const cssText = styleElement.innerHTML;
    const rootMatch = cssText.match(/:root\s*{\s*([^}]*?)\s*}/);
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
      cardShadowColor: { light: "#BBBBBB" },
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
    expect(variables["--fb-survey-shadow-color"]).toBeDefined(); // Relies on mixColor
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
    expect(variables["--fb-accent-background-color"]).toBeDefined(); // Relies on mixColor
    expect(variables["--fb-accent-background-color-selected"]).toBeDefined(); // Relies on mixColor
    // calendar-tile-color depends on isLight(brandColor)
    expect(variables["--fb-calendar-tile-color"]).toBeUndefined(); // isLight('#112233') is false, so this should be undefined
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
});

describe("getBaseProjectStyling_Helper", () => {
  test("should return default values for all properties when no overrides are provided", () => {
    const baseStyling = getBaseProjectStyling();
    expect(baseStyling.brandColor).toBeNull();
    expect(baseStyling.cardBackgroundColor).toBeNull();
    expect(baseStyling.cardBorderColor).toBeNull();
    expect(baseStyling.cardShadowColor).toBeNull();
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
