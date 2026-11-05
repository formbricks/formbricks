import { describe, expect, test } from "vitest";
import { DEFAULT_CREATIVE_STYLING, parseCreativeTypedGroups } from "./creative";

const feedbackButtonContent = { label: { "en-US": "Feedback" }, icon: null };

const storedButton = (theme: Record<string, unknown>) => ({
  type: "feedbackButton" as const,
  content: feedbackButtonContent,
  styling: {
    ...DEFAULT_CREATIVE_STYLING.feedbackButton,
    theme: { ...DEFAULT_CREATIVE_STYLING.feedbackButton.theme, customStyles: true, ...theme },
  },
});

describe("parseCreativeTypedGroups", () => {
  test("reads a colour stored as a plain string (before Light / Dark) as its light value", () => {
    const groups = parseCreativeTypedGroups(
      storedButton({ backgroundColor: "#0f766e", textColor: null, borderColor: "#000000" })
    );

    expect(groups?.styling.theme).toMatchObject({
      backgroundColor: { light: "#0f766e" },
      textColor: null,
      borderColor: { light: "#000000" },
    });
  });

  test("reads a banner's legacy colours the same way", () => {
    const groups = parseCreativeTypedGroups({
      type: "banner",
      content: {
        message: { "en-US": [{ text: "Down tonight." }] },
        button: null,
        dismissible: true,
        accessibleName: null,
      },
      styling: {
        ...DEFAULT_CREATIVE_STYLING.banner,
        theme: { ...DEFAULT_CREATIVE_STYLING.banner.theme, textColor: "#78350f" },
      },
    });

    expect(groups?.styling.theme.textColor).toEqual({ light: "#78350f" });
  });

  test("keeps colours already stored per appearance", () => {
    const color = { light: "#1e3a8a", dark: "#bfdbfe" };

    expect(parseCreativeTypedGroups(storedButton({ backgroundColor: color }))?.styling.theme).toMatchObject({
      backgroundColor: color,
    });
  });

  test("still refuses a stored colour that is not a colour", () => {
    expect(parseCreativeTypedGroups(storedButton({ backgroundColor: "red" }))).toBeNull();
    expect(parseCreativeTypedGroups(storedButton({ backgroundColor: 12 }))).toBeNull();
  });
});
