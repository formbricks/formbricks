import { createId } from "@paralleldrive/cuid2";

/**
 * The kitchen-sink survey content: one question of every renderable type. A pure module (no database, no
 * app code) so the accessibility suite that seeds it and the specs that only render it, such as the CSP
 * gate, share one list. A question type added here is covered by every suite that uses it.
 */

/** Headline of the first (open text) question — an `<h2>` wrapping a real `<label>`. */
export const OPEN_TEXT_HEADLINE = "What feedback do you have for us?";

/** Headline of the single-select question, which names its radiogroup via aria-labelledby. */
export const SINGLE_SELECT_HEADLINE = "Which plan are you on?";

export type I18n = { default: string; [lang: string]: string };

// Named so the i18n scanner's t(...) pattern does not treat these fixture
// strings as translation keys (this file is scanned; *.spec.ts files are not).
export const i18nValue = (value: string): I18n => ({ default: value });

// A stable, valid storage URL for picture-selection choices. Public assets under
// apps/web/public are always served by the app and satisfy ZStorageUrl, so the
// picture-select card renders without depending on the storage mock.
const pictureUrl = (baseURL: string, path: string): string => new URL(path, baseURL).toString();

/**
 * Builds the kitchen-sink question list covering every renderable question type.
 * IDs use cuid2 (alphanumeric, allowed by ZSurveyQuestionId) and are unique per
 * call so parallel workers never collide.
 */
export const buildKitchenSinkQuestions = (baseURL: string) => [
  {
    id: createId(),
    type: "openText",
    headline: i18nValue(OPEN_TEXT_HEADLINE),
    subheader: i18nValue("Share anything that comes to mind."),
    placeholder: i18nValue("Type your answer here..."),
    required: true,
    inputType: "text",
    charLimit: { enabled: false },
  },
  {
    id: createId(),
    type: "multipleChoiceSingle",
    headline: i18nValue(SINGLE_SELECT_HEADLINE),
    required: true,
    choices: [
      { id: createId(), label: i18nValue("Free") },
      { id: createId(), label: i18nValue("Pro") },
      { id: createId(), label: i18nValue("Enterprise") },
    ],
  },
  {
    id: createId(),
    type: "multipleChoiceMulti",
    headline: i18nValue("Which features do you use? (select all that apply)"),
    required: true,
    choices: [
      { id: createId(), label: i18nValue("Surveys") },
      { id: createId(), label: i18nValue("Contacts") },
      { id: createId(), label: i18nValue("Integrations") },
    ],
  },
  {
    id: createId(),
    type: "rating",
    headline: i18nValue("How would you rate your experience?"),
    required: true,
    scale: "star",
    range: 5,
    lowerLabel: i18nValue("Poor"),
    upperLabel: i18nValue("Excellent"),
  },
  {
    id: createId(),
    type: "ranking",
    headline: i18nValue("Rank these in order of importance"),
    required: true,
    choices: [
      { id: createId(), label: i18nValue("Speed") },
      { id: createId(), label: i18nValue("Reliability") },
      { id: createId(), label: i18nValue("Support") },
    ],
  },
  {
    id: createId(),
    type: "matrix",
    headline: i18nValue("How much do you agree?"),
    required: true,
    rows: [
      { id: createId(), label: i18nValue("The product is easy to use") },
      { id: createId(), label: i18nValue("Support is responsive") },
    ],
    columns: [
      { id: createId(), label: i18nValue("Agree") },
      { id: createId(), label: i18nValue("Neutral") },
      { id: createId(), label: i18nValue("Disagree") },
    ],
  },
  {
    id: createId(),
    type: "date",
    headline: i18nValue("When did you start using us?"),
    required: true,
    format: "M-d-y",
  },
  {
    id: createId(),
    type: "fileUpload",
    headline: i18nValue("Upload a screenshot (optional)"),
    required: false,
    allowMultipleFiles: false,
  },
  // NOTE: no `cal` question on purpose — the Cal.com embed loads a live third-party
  // iframe, which would make the unattended axe walk depend on external network and
  // markup we do not control (its violations would all be wontfix-allowlisted anyway).
  // The wrapper Formbricks DOES own is scanned in `buildAnsweredStatesQuestions`
  // below, where the spec blocks the embed origin instead of loading it.
  {
    id: createId(),
    type: "pictureSelection",
    headline: i18nValue("Pick the image you prefer"),
    required: true,
    allowMulti: false,
    choices: [
      { id: createId(), imageUrl: pictureUrl(baseURL, "/logo-transparent.png") },
      { id: createId(), imageUrl: pictureUrl(baseURL, "/favicon/android-chrome-192x192.png") },
    ],
  },
  {
    id: createId(),
    type: "cta",
    headline: i18nValue("Thanks for the detail!"),
    subheader: i18nValue("Tap continue to wrap up."),
    required: false,
    buttonExternal: false,
  },
];
