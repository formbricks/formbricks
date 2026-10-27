import type { TBannerForm, TFeedbackButtonForm } from "./editor-form";

/**
 * The texts a creative has, per type, in one list: the v3 write rules, the editor's form, its publish
 * check, the Language tab and the MCP schema test all read it instead of spelling the texts out. Each
 * text is a locale-keyed map somewhere in v3 `content`; the editor holds it under `field`, both in the
 * Content tab's form and in each other language's translation.
 */

export type TCreativeTextField = "label" | "message" | "buttonLabel" | "accessibleName";

/** One step of a text's path in v3 `content`; `nullable` when that step can be `null` (no button, no name). */
type TCreativeTextPathStep = Readonly<{ key: string; nullable?: true }>;

export type TCreativeTextSpec = Readonly<{
  field: TCreativeTextField;
  path: readonly TCreativeTextPathStep[];
  /**
   * Publishing needs it in the default language while the creative has it: how the API's refusal names
   * it, and the editor's issue. `null`: never required.
   */
  publish: Readonly<{
    name: string;
    issue: "label_missing" | "message_missing" | "button_label_missing";
  }> | null;
}>;

export const CREATIVE_TEXTS = {
  feedbackButton: [
    { field: "label", path: [{ key: "label" }], publish: { name: "label", issue: "label_missing" } },
  ],
  banner: [
    { field: "message", path: [{ key: "message" }], publish: { name: "message", issue: "message_missing" } },
    {
      field: "buttonLabel",
      path: [{ key: "button", nullable: true }, { key: "label" }],
      publish: { name: "button label", issue: "button_label_missing" },
    },
    // Optional: without one, visitors hear "Site notice" in their own language.
    { field: "accessibleName", path: [{ key: "accessibleName", nullable: true }], publish: null },
  ],
} as const satisfies Record<"feedbackButton" | "banner", readonly TCreativeTextSpec[]>;

/** The text's dotted path in v3 `content`, as `invalid_params` names it (`button.label`). */
export const getCreativeTextPath = (text: TCreativeTextSpec): string =>
  text.path.map(({ key }) => key).join(".");

/** The text's locale-keyed map in a v3 `content`, or `null` while the creative doesn't have the text. */
export const readCreativeTextMap = <T = unknown>(
  content: object,
  text: TCreativeTextSpec
): Record<string, T> | null => {
  let node: unknown = content;
  for (const { key } of text.path) {
    if (typeof node !== "object" || node === null) return null;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === "object" && node !== null ? (node as Record<string, T>) : null;
};

/**
 * The texts the editor's Content form has right now: a banner's button label only while its button is
 * on, its Accessible name only while one is written (otherwise visitors hear "Site notice").
 */
export const getCreativeFormTexts = (
  content: TFeedbackButtonForm | TBannerForm
): readonly TCreativeTextSpec[] =>
  CREATIVE_TEXTS[content.type].filter(({ field }) => {
    if (content.type !== "banner") return true;
    if (field === "buttonLabel") return content.hasButton;
    if (field === "accessibleName") return content.accessibleName.trim() !== "";
    return true;
  });

/** The Content form's value of one of its texts (the form names its fields after the texts). */
export const readCreativeFormText = (
  content: TFeedbackButtonForm | TBannerForm,
  field: TCreativeTextField
): unknown => (content as Partial<Record<TCreativeTextField, unknown>>)[field];

/** A text with nothing to read: blank, or a message whose every run is blank. */
export const isBlankCreativeText = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.every((run: { text?: unknown }) => typeof run.text !== "string" || run.text.trim() === "");
  }
  return typeof value !== "string" || value.trim() === "";
};
