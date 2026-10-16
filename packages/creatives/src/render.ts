import type {
  TCreativeColors,
  TCreativeSize,
  TCreativeStyle,
  TCreativeType,
  TCreativeView,
  TFeedbackButtonPlacement,
  TFeedbackButtonView,
} from "./types";

/**
 * The stable class of each type's root element inside its shadow root: what a creative's own Custom CSS
 * is scoped to (the server compiles it for this root) and what it can target.
 */
export const CREATIVE_ROOT_CLASS = {
  feedbackButton: "fb-creative-button",
  banner: "fb-creative-banner",
} as const satisfies Record<TCreativeType, string>;

export interface TRenderOptions {
  /** Called on every press; the SDK decides what it opens (`resolveClick`). */
  onClick: () => void;
  /** The page's CSP nonce, for the shadow root's style element. */
  nonce?: string;
  /** Where the creative goes. Defaults to the end of `<body>`. */
  root?: HTMLElement;
  /**
   * The visitor's appearance, already resolved (the SDK decides `system` from `prefers-color-scheme`).
   * Light by default. Both palettes are in the stylesheet; this sets the root's `data-appearance`.
   */
  appearance?: "light" | "dark";
  /** Forces the desktop or the phone values, for a preview; by default the viewport width decides. */
  device?: "desktop" | "phone";
}

/** Below this viewport width a creative uses its phone values. */
const PHONE_MEDIA = "(max-width: 767.98px)";

/** Under the survey popup (`z-999999`), so an open survey covers the button that opened it. */
const Z_INDEX = 999998;

/** The survey font: the stack the survey renderer sets on `#fbjs`, which loads nothing. */
const SURVEY_FONT = "Inter,Helvetica,Arial,sans-serif";

const colorsCss = ({ backgroundColor, textColor, borderColor }: TCreativeColors): string =>
  `color:${textColor};background:${backgroundColor};border:${borderColor ? `1px solid ${borderColor}` : "0"}`;

const isSameSize = (a: TCreativeSize, b: TCreativeSize): boolean =>
  a.fontSize === b.fontSize && a.paddingX === b.paddingX && a.paddingY === b.paddingY;

/**
 * What every creative's stylesheet shares around its own rules: the reset (with the page's font let in
 * only when Page font is on), and the creative's own CSS last. The order statement makes its dark layer
 * win over its light one; inside the shadow root nothing else uses those layers.
 */
const withSharedCss = ({ pageFont, customCss }: TCreativeStyle, rules: string): string =>
  `:host{all:initial${pageFont ? ";font-family:inherit" : ""}}${rules}` +
  (customCss ? `@layer fb-survey-dark,fb-survey;${customCss.light ?? ""}${customCss.dark ?? ""}` : "");

/**
 * Every box property is set, so a phone placement fully replaces a desktop one on another edge. Side
 * tabs run their label bottom to top and round the corners that face the page.
 */
const placementCss = (
  { edge, offset }: TFeedbackButtonPlacement,
  { paddingX, paddingY }: TCreativeSize,
  radius: number
): string => {
  if (edge === "bottom") {
    return `top:auto;right:auto;bottom:0;left:${offset}%;transform:translateX(-${offset}%);writing-mode:horizontal-tb;padding:${paddingY}px ${paddingX}px;border-radius:${radius}px ${radius}px 0 0`;
  }
  // `rotate(180deg)` turns the box's own right corners to face the page on the right edge.
  const corners = edge === "right" ? `0 ${radius}px ${radius}px 0` : `${radius}px 0 0 ${radius}px`;
  return `top:${offset}%;right:${edge === "right" ? "0" : "auto"};bottom:auto;left:${edge === "left" ? "0" : "auto"};transform:translateY(-${offset}%) rotate(180deg);writing-mode:vertical-rl;padding:${paddingX}px ${paddingY}px;border-radius:${corners}`;
};

/**
 * Desktop values outside the phone media query and phone values inside it (only when they differ), both
 * appearances keyed on `data-appearance`. A forced `device` draws that device's values with no query.
 */
const feedbackButtonCss = (
  { style, position }: TFeedbackButtonView,
  device?: "desktop" | "phone"
): string => {
  const { element } = style;
  const isPhone = device === "phone";
  const size = isPhone ? element.phone : element.desktop;
  const phonePlacement = position.phone ?? position.desktop;
  const sizeCss = (placement: TFeedbackButtonPlacement, deviceSize: TCreativeSize): string =>
    `font-size:${deviceSize.fontSize}px;${placementCss(placement, deviceSize, element.borderRadius)}`;

  return withSharedCss(
    style,
    `.fb-creative-button{all:initial;box-sizing:border-box;position:fixed;z-index:${Z_INDEX};cursor:pointer;white-space:nowrap;font-family:${style.pageFont ? "inherit" : SURVEY_FONT};font-weight:${element.fontWeight};line-height:1.25;${colorsCss(element.light)};${sizeCss(isPhone ? phonePlacement : position.desktop, size)}}` +
      `.fb-creative-button[data-appearance=dark]{${colorsCss(element.dark)}}` +
      `.fb-creative-button:focus-visible{outline:2px solid ${element.light.backgroundColor};outline-offset:2px}` +
      (device || (!position.phone && isSameSize(element.desktop, element.phone))
        ? ""
        : `@media ${PHONE_MEDIA}{.fb-creative-button{${sizeCss(phonePlacement, element.phone)}}}`)
  );
};

/**
 * Draws a creative into its own shadow root (ADR 0003): `:host { all: initial }` keeps the page's
 * inherited styles out, sizes are px so the page's root font size can't scale them, and only the
 * creative's own CSS enters. Returns the host element it appended, or `null` for a type this renderer
 * doesn't draw yet. Remove the host to take the creative off the page.
 */
export const render = (
  view: TCreativeView,
  { onClick, nonce, root, appearance = "light", device }: TRenderOptions
): HTMLElement | null => {
  // Banners arrive with ENG-3576.
  if (view.type !== "feedbackButton") return null;

  const parent = root ?? document.body;
  const doc = parent.ownerDocument;
  const host = doc.createElement("div");
  host.setAttribute("data-formbricks-creative", view.id);
  const shadow = host.attachShadow({ mode: "open" });

  const style = doc.createElement("style");
  if (nonce) style.setAttribute("nonce", nonce);
  style.textContent = feedbackButtonCss(view, device);

  const button = doc.createElement("button");
  button.type = "button";
  button.className = CREATIVE_ROOT_CLASS.feedbackButton;
  // The dark palette and the creative's dark CSS key on it (`[data-appearance=dark]`), as on `#fbjs`.
  button.setAttribute("data-appearance", appearance);
  button.textContent = view.label;
  button.addEventListener("click", onClick);

  shadow.append(style, button);
  parent.append(host);
  return host;
};
