import type { TCreativeView, TFeedbackButtonPlacement, TFeedbackButtonView } from "./types";

export interface TRenderOptions {
  /** Called on every press; the SDK decides what it opens (`resolveClick`). */
  onClick: () => void;
  /** The page's CSP nonce, for the shadow root's style element. */
  nonce?: string;
  /** Where the creative goes. Defaults to the end of `<body>`. */
  root?: HTMLElement;
}

/** Below this viewport width a creative uses its phone values. */
const PHONE_MEDIA = "(max-width: 767.98px)";

/** Under the survey popup (`z-999999`), so an open survey covers the button that opened it. */
const Z_INDEX = 999998;

const FONT_STACK = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

/**
 * Every box property is set, so a phone placement fully replaces a desktop one on another edge. Side
 * tabs run their label bottom to top and round the corners that face the page.
 */
const placementCss = ({ edge, offset }: TFeedbackButtonPlacement, view: TFeedbackButtonView): string => {
  const { paddingX, paddingY, borderRadius: radius } = view.style;
  if (edge === "bottom") {
    return `top:auto;right:auto;bottom:0;left:${offset}%;transform:translateX(-${offset}%);writing-mode:horizontal-tb;padding:${paddingY}px ${paddingX}px;border-radius:${radius}px ${radius}px 0 0`;
  }
  // `rotate(180deg)` turns the box's own right corners to face the page on the right edge.
  const corners = edge === "right" ? `0 ${radius}px ${radius}px 0` : `${radius}px 0 0 ${radius}px`;
  return `top:${offset}%;right:${edge === "right" ? "0" : "auto"};bottom:auto;left:${edge === "left" ? "0" : "auto"};transform:translateY(-${offset}%) rotate(180deg);writing-mode:vertical-rl;padding:${paddingX}px ${paddingY}px;border-radius:${corners}`;
};

const feedbackButtonCss = (view: TFeedbackButtonView): string => {
  const { style, position } = view;
  const border = style.borderColor ? `1px solid ${style.borderColor}` : "0";
  return [
    ":host{all:initial}",
    `.fb-creative-button{all:initial;box-sizing:border-box;position:fixed;z-index:${Z_INDEX};cursor:pointer;white-space:nowrap;font-family:${FONT_STACK};font-size:${style.fontSize}px;font-weight:${style.fontWeight};line-height:1.25;color:${style.textColor};background:${style.backgroundColor};border:${border};${placementCss(position.desktop, view)}}`,
    `.fb-creative-button:focus-visible{outline:2px solid ${style.backgroundColor};outline-offset:2px}`,
    position.phone ? `@media ${PHONE_MEDIA}{.fb-creative-button{${placementCss(position.phone, view)}}}` : "",
  ].join("");
};

/**
 * Draws a creative into its own shadow root (ADR 0003): `:host { all: initial }` keeps the page's
 * inherited styles out, sizes are px so the page's root font size can't scale them, and only the
 * creative's own CSS enters. Returns the host element it appended, or `null` for a type this renderer
 * doesn't draw yet. Remove the host to take the creative off the page.
 */
export const render = (view: TCreativeView, { onClick, nonce, root }: TRenderOptions): HTMLElement | null => {
  // Banners arrive with ENG-3576.
  if (view.type !== "feedbackButton") return null;

  const parent = root ?? document.body;
  const doc = parent.ownerDocument;
  const host = doc.createElement("div");
  host.setAttribute("data-formbricks-creative", view.id);
  const shadow = host.attachShadow({ mode: "open" });

  const style = doc.createElement("style");
  if (nonce) style.setAttribute("nonce", nonce);
  style.textContent = feedbackButtonCss(view);

  const button = doc.createElement("button");
  button.type = "button";
  button.className = "fb-creative-button";
  button.textContent = view.label;
  button.addEventListener("click", onClick);

  shadow.append(style, button);
  parent.append(host);
  return host;
};
