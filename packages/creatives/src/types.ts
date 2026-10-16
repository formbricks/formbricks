import type { TShowConditions } from "@formbricks/types/show-conditions";

/**
 * The delivery contract (ENG-3994): what the environment payload tells the web SDK about each creative.
 *
 * `GET /api/v1/client/{workspaceId}/environment` answers `{ data: { data, expiresAt, serverTime } }`.
 * `data.creatives` is present only when the workspace has at least one deliverable creative, so SDKs and
 * cached states from before creatives never see the key. A creative is deliverable while it is
 * published and not paused, closed or archived by its author, its end time has not passed, and its
 * Destination survey (if any) is Active. Its start time is NOT applied on the server: the payload is
 * cached for a minute and kept by the SDK for up to an hour, so the SDK decides the schedule to the
 * minute on its own clock, corrected by `serverTime` (see `getClockOffset`).
 *
 * Texts are keyed by locale code, exactly as the v3 API stores them. Everything here is plain JSON.
 */

export type TCreativeType = "feedbackButton" | "banner";

/** Plain text per locale code. Always holds the creative's `defaultLanguage`. */
export type TCreativeText = Record<string, string>;

/**
 * A language a creative's texts are written in (ENG-4003), in the shape survey languages have in the same
 * payload, so one matcher reads both. `alias` is the workspace language's alias, matched like a code.
 * A disabled language is never picked; its visitors get the default language.
 */
export interface TCreativeLanguage {
  default: boolean;
  enabled: boolean;
  language: { code: string; alias: string | null };
}

/** One stretch of banner text with the same formatting. Never HTML. */
export interface TCreativeTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** `https://`, `http://`, `mailto:`, `tel:` or a root-relative path. */
  href?: string;
}

export type TCreativeIcon = "messageSquare" | "messageCircle" | "megaphone" | "sparkles";

/** A feedback button's edge, plus its offset along that edge in percent (from the top, or the left). */
export interface TFeedbackButtonPlacement {
  edge: "left" | "right" | "bottom";
  offset: number;
}

export type TBannerPlacement =
  | { placement: "top"; layout: "inPage" | "overlay" }
  | { placement: "bottom"; layout: "overlay" };

/** Desktop placement, plus the one used below 768 px viewport width (`null` keeps the desktop one). */
export interface TCreativePosition<TPlacement> {
  desktop: TPlacement;
  phone: TPlacement | null;
}

/**
 * What pressing a creative opens.
 * - An app survey opens as a popup. It is always in the same payload's `data.surveys`, even when it is
 *   not among the 30 newest app surveys, and is sent with `triggers: []` when only creatives open it.
 * - A link survey opens its public link in a new tab, with `?creativeId=` added, and `lang=` with the
 *   language the site set (`setLanguage`), if any; the link page falls back as it always does.
 * - A link opens as given, in a new tab.
 */
export type TCreativeDestination =
  | { type: "survey"; surveyId: string; opensAs: "popup" }
  | { type: "survey"; surveyId: string; opensAs: "newTab"; url: string }
  | { type: "link"; url: string };

interface TCreativePayloadBase {
  id: string;
  /** The locale code the texts fall back to. */
  defaultLanguage: string;
  /**
   * Every language the texts are written in, the default first (ENG-4003). A visitor's language is
   * matched against them as the SDK matches a survey's languages; a visitor whose language is missing
   * or disabled, or whose translation of a text is empty, sees the default language.
   */
  languages: TCreativeLanguage[];
  /**
   * Whether the browser's languages pick the language when the site set none with `setLanguage`: the
   * Destination survey's "Use browser language" setting. `false` when it opens no survey.
   */
  autoSelectLanguage: boolean;
  /** The look, computed by the server and only applied by the SDK (ENG-3998). */
  style: TCreativeStyle;
  /** `null` only for a banner without a button. */
  destination: TCreativeDestination | null;
  showOn: "pageView" | "action";
  /** Names of the actions that show it when `showOn` is `action`, as survey triggers name them. */
  triggers: string[];
  /** Show when (`ZShowConditions`, shared with surveys); `null` always passes. */
  conditions: TShowConditions;
  /** Share of visitors in percent; `null` shows it to everyone. */
  displayPercentage: number | null;
  /** ISO instants; `null` is unbounded. */
  startAt: string | null;
  endAt: string | null;
}

export interface TFeedbackButtonPayload extends TCreativePayloadBase {
  type: "feedbackButton";
  content: { label: TCreativeText; icon: TCreativeIcon | null };
  position: TCreativePosition<TFeedbackButtonPlacement>;
}

export interface TBannerPayload extends TCreativePayloadBase {
  type: "banner";
  content: {
    message: Record<string, TCreativeTextRun[]>;
    button: { label: TCreativeText } | null;
    dismissible: boolean;
    accessibleName: TCreativeText | null;
  };
  /**
   * The texts the SDK draws that the author doesn't write (ENG-4003), in every language a visitor can
   * get (the default and the enabled ones), filled in by the server: `siteNotice`, the region name when
   * `accessibleName` is null, and `dismiss`, the Dismiss control's name.
   */
  labels: { siteNotice: TCreativeText; dismiss: TCreativeText };
  position: TCreativePosition<TBannerPlacement>;
}

/** One entry of the environment payload's `data.creatives`. */
export type TCreativePayload = TFeedbackButtonPayload | TBannerPayload;

/** An element's colours in one appearance, `#rrggbb`. `borderColor: null` draws no border. */
export interface TCreativeColors {
  backgroundColor: string;
  textColor: string;
  borderColor: string | null;
}

/** An element's size on one device, in px. */
export interface TCreativeSize {
  fontSize: number;
  paddingX: number;
  paddingY: number;
}

/**
 * How one element of a creative looks, ready to apply: colours per appearance (light, dark), sizes per
 * device (desktop, and phone below 768 px viewport width). Everything is px or `#rrggbb`; nothing here
 * needs the workspace styling or the creative's custom styles any more.
 */
export interface TCreativeElementStyle {
  light: TCreativeColors;
  dark: TCreativeColors;
  desktop: TCreativeSize;
  phone: TCreativeSize;
  borderRadius: number;
  fontWeight: number;
}

/**
 * Compiled Custom CSS of one creative, scoped to its root element (`.fb-creative-button` or
 * `.fb-creative-banner`), every declaration `!important`, wrapped in the `fb-survey` (light) and
 * `fb-survey-dark` layers, dark rules keyed on the root's `data-appearance="dark"`. Third-party loads are
 * already stripped. Absent keys mean no CSS for that appearance.
 */
export interface TCreativeCustomCss {
  light?: string;
  dark?: string;
}

/**
 * A creative's look (ENG-3998), computed by the server from the workspace Look & Feel and the creative's
 * custom styles: a feedback button starts from the survey button, a banner from the survey card with the
 * survey button inside. The SDK only applies it.
 */
export interface TCreativeStyle {
  /** The feedback button itself, or the banner's bar. */
  element: TCreativeElementStyle;
  /** The banner's button, which always looks like the survey button; `null` for a feedback button. */
  button: TCreativeElementStyle | null;
  /** `true`: the host page's font (Page font). `false`: the survey font. */
  pageFont: boolean;
  /** The creative's own CSS; `null` when it has none or its custom styles are off. */
  customCss: TCreativeCustomCss | null;
}

/** A creative `resolve` decided to show, with its texts picked: what `render` draws. */
export interface TFeedbackButtonView {
  id: string;
  type: "feedbackButton";
  label: string;
  icon: TCreativeIcon | null;
  position: TCreativePosition<TFeedbackButtonPlacement>;
  style: TCreativeStyle;
  destination: TCreativeDestination;
}

export interface TBannerView {
  id: string;
  type: "banner";
  message: TCreativeTextRun[];
  buttonLabel: string | null;
  dismissible: boolean;
  /** The region's name; `null` draws "Site notice" in English (a view built without labels). */
  accessibleName: string | null;
  /** The Dismiss control's name; absent draws "Dismiss" in English (a view built without labels). */
  dismissLabel?: string;
  position: TCreativePosition<TBannerPlacement>;
  style: TCreativeStyle;
  destination: TCreativeDestination | null;
}

export type TCreativeView = TFeedbackButtonView | TBannerView;
