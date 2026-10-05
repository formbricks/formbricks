/**
 * Stable styling hooks for custom CSS (ENG-3554, contract decided in M2.02).
 *
 * Each hook is a `data-fb-part` attribute on a survey element. Together with the `--fb-*` variables
 * and native/ARIA state attributes, these names are the whole public styling contract: customers
 * write `#fbjs [data-fb-part="button-primary"]:hover { … }` and can rely on it across releases.
 * Generated Tailwind classes and the DOM structure around a hook are not part of the contract.
 *
 * Declare every name here and nowhere else. Components set the attribute from this map, and the
 * customer documentation (docs/xm-and-surveys/surveys/general-features/custom-css.mdx) lists the
 * same names — `parts.test.ts` keeps the two in sync. Renaming or removing a value breaks customer
 * stylesheets, so treat it like a breaking API change.
 */
export const FB_PART_ATTRIBUTE = "data-fb-part";

export const FB_PART = {
  /** The visible card surface that holds a question, welcome or ending screen. */
  card: "card",
  /** Headline of a question, welcome card or ending card. */
  headline: "headline",
  /** Description (subheader) under a headline. */
  description: "description",
  /** One selectable choice: a list row, picture tile, ranking item or an item of an open dropdown. */
  option: "option",
  /** The text of a choice, and the consent checkbox label. */
  optionLabel: "option-label",
  /** The radio circle or checkbox square of a choice, and the consent checkbox. */
  optionControl: "option-control",
  /** A single-line text field (open text, contact info, address, "Other" text, dropdown search). */
  input: "input",
  /** A multi-line text field. */
  textarea: "textarea",
  /** The button that opens a dropdown choice list. */
  dropdown: "dropdown",
  /** Next, Submit and the other primary actions (welcome, ending and call-to-action buttons). */
  buttonPrimary: "button-primary",
  /** The Back button. */
  buttonBack: "button-back",
  /** The close (X) button of a website or app survey. */
  buttonClose: "button-close",
  /** A validation message, present only while there is an error to show. */
  error: "error",
  /** The bordered box around the consent checkbox. */
  consent: "consent",
  /** The "Powered by Formbricks" link. */
  branding: "branding",
  /** The progress bar track. */
  progress: "progress",
} as const;

export type TFbPart = (typeof FB_PART)[keyof typeof FB_PART];

/** Every hook name, in declaration order. */
export const FB_PARTS: readonly TFbPart[] = Object.values(FB_PART);
