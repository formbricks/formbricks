import { CREATIVE_ICON_PATHS } from "./icons";
import type {
  TBannerPlacement,
  TBannerView,
  TCreativeColors,
  TCreativeSize,
  TCreativeStyle,
  TCreativeTextRun,
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
  /**
   * Called when the visitor dismisses a dismissible banner. The host stays where it is: the caller takes
   * it off the page (the SDK, for that page view only) or keeps it (a preview).
   */
  onDismiss?: () => void;
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

/** Below this viewport width a creative uses its phone values (placement and sizes). */
export const CREATIVE_PHONE_MEDIA = "(max-width: 767.98px)";

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
const withSharedCss = ({ pageFont, customCss }: TCreativeStyle, rules: string, hostCss = ""): string =>
  `:host{all:initial${hostCss}${pageFont ? ";font-family:inherit" : ""}}${rules}` +
  (customCss ? `@layer fb-survey-dark,fb-survey;${customCss.light ?? ""}${customCss.dark ?? ""}` : "");

/**
 * How a creative keeps clear of the Overlay banners on screen (ENG-3576): custom properties, in px, set
 * on its host by whoever lays the page out (the SDK). On a feedback button they are the space all
 * Overlay banners take at the top and at the bottom of the viewport; on an Overlay banner, the space the
 * newer ones on its edge take, so same-edge banners stack newest first. Unset (a preview) they are 0.
 * Set with `host.style.setProperty`, which a CSP without `'unsafe-inline'` allows.
 */
export const CREATIVE_INSET_PROPERTY = { top: "--fb-creative-top", bottom: "--fb-creative-bottom" } as const;

const TOP_INSET = `var(${CREATIVE_INSET_PROPERTY.top},0px)`;
const BOTTOM_INSET = `var(${CREATIVE_INSET_PROPERTY.bottom},0px)`;

/**
 * Every box property is set, so a phone placement fully replaces a desktop one on another edge. Side
 * tabs run their label bottom to top and round the corners that face the page. A button keeps clear
 * of Overlay banners: a bottom tab sits above them, and a side tab's offset runs along the part of the
 * edge they leave free.
 */
const placementCss = (
  { edge, offset }: TFeedbackButtonPlacement,
  { paddingX, paddingY }: TCreativeSize,
  radius: number
): string => {
  if (edge === "bottom") {
    return `top:auto;right:auto;bottom:${BOTTOM_INSET};left:${offset}%;transform:translateX(-${offset}%);writing-mode:horizontal-tb;padding:${paddingY}px ${paddingX}px;border-radius:${radius}px ${radius}px 0 0`;
  }
  // `rotate(180deg)` turns the box's own right corners to face the page on the right edge.
  const corners = edge === "right" ? `0 ${radius}px ${radius}px 0` : `${radius}px 0 0 ${radius}px`;
  return `top:calc(${TOP_INSET} + (100% - ${TOP_INSET} - ${BOTTOM_INSET}) * ${offset / 100});right:${edge === "right" ? "0" : "auto"};bottom:auto;left:${edge === "left" ? "0" : "auto"};transform:translateY(-${offset}%) rotate(180deg);writing-mode:vertical-rl;padding:${paddingX}px ${paddingY}px;border-radius:${corners}`;
};

/**
 * A two-colour focus ring, visible on any page: the label colour right around the button (it contrasts
 * with the button), then the button colour around that (it contrasts with the label colour), so
 * whatever the page behind looks like, one of the two stands out from it. Forced-colors mode drops
 * shadows and paints the transparent outline in the system focus colour instead.
 */
const focusRingCss = ({ textColor, backgroundColor }: TCreativeColors): string =>
  `box-shadow:0 0 0 2px ${textColor},0 0 0 4px ${backgroundColor}`;

/**
 * The icon in the label's proportions on the survey button (a 16 px icon 8 px from a 14 px label), in
 * px. On a side edge it turns with the label: vertical text sets upright glyphs a quarter turn
 * clockwise, and the whole tab is then turned half a turn.
 */
const iconCss = ({ edge }: TFeedbackButtonPlacement, { fontSize }: TCreativeSize): string => {
  const iconSize = Math.round((fontSize * 8) / 7);
  return `.fb-creative-button-icon{flex:none;width:${iconSize}px;height:${iconSize}px;transform:${edge === "bottom" ? "none" : "rotate(90deg)"}}`;
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
  const placement = isPhone ? phonePlacement : position.desktop;
  const sizeCss = (devicePlacement: TFeedbackButtonPlacement, deviceSize: TCreativeSize): string =>
    `font-size:${deviceSize.fontSize}px;gap:${Math.round((deviceSize.fontSize * 4) / 7)}px;${placementCss(devicePlacement, deviceSize, element.borderRadius)}`;

  return withSharedCss(
    style,
    `.fb-creative-button{all:initial;box-sizing:border-box;position:fixed;z-index:${Z_INDEX};display:flex;align-items:center;cursor:pointer;white-space:nowrap;font-family:${style.pageFont ? "inherit" : SURVEY_FONT};font-weight:${element.fontWeight};line-height:1.25;${colorsCss(element.light)};${sizeCss(placement, size)}}` +
      iconCss(placement, size) +
      `.fb-creative-button[data-appearance=dark]{${colorsCss(element.dark)}}` +
      `.fb-creative-button:hover{opacity:.9}.fb-creative-button:active{opacity:.8}` +
      `.fb-creative-button:focus-visible{outline:2px solid transparent;outline-offset:2px;${focusRingCss(element.light)}}` +
      `.fb-creative-button[data-appearance=dark]:focus-visible{${focusRingCss(element.dark)}}` +
      (device || (!position.phone && isSameSize(element.desktop, element.phone))
        ? ""
        : `@media ${CREATIVE_PHONE_MEDIA}{.fb-creative-button{${sizeCss(phonePlacement, element.phone)}}${iconCss(phonePlacement, element.phone)}}`)
  );
};

/** Font size and padding of one element on one device. */
const deviceSizeCss = ({ fontSize, paddingX, paddingY }: TCreativeSize): string =>
  `font-size:${fontSize}px;padding:${paddingY}px ${paddingX}px`;

/**
 * A banner's colours. Its border runs only along the edge that faces the page, so it is drawn with a
 * colour here and a width per placement; a bar without a border colour keeps a transparent one, so both
 * appearances and both placements have the same height.
 */
const barColorsCss = ({ backgroundColor, textColor, borderColor }: TCreativeColors): string =>
  `color:${textColor};background:${backgroundColor};border-color:${borderColor ?? "transparent"}`;

/**
 * A banner's place on one device. In page sits in the page flow and scrolls away with it; an Overlay is
 * fixed to its edge, below the newer Overlay banners on that edge (`CREATIVE_INSET_PROPERTY`), and never
 * taller than a third of the viewport. Every box property is set, so a phone placement fully replaces
 * the desktop one.
 */
const bannerPlacementCss = ({ placement, layout }: TBannerPlacement): string => {
  const isTop = placement === "top";
  const edges =
    layout === "inPage"
      ? "position:relative;top:auto;bottom:auto;z-index:auto;max-height:none;overflow:visible"
      : `position:fixed;${isTop ? `top:${TOP_INSET};bottom:auto` : `top:auto;bottom:${BOTTOM_INSET}`};z-index:${Z_INDEX};max-height:33vh;overflow-y:auto`;
  return `${edges};left:0;right:0;border-width:${isTop ? "0 0 1px" : "1px 0 0"}`;
};

/**
 * A bar with the message and the optional button centred (wrapping onto more lines on narrow screens),
 * and the dismiss control at the end. The bar takes the survey card's look, its button the survey
 * button's. Phone values sit in the phone media query, with 44 px touch targets; a forced `device`
 * draws that device's values with no query. Nothing animates: the banner appears in one step.
 */
const bannerCss = ({ style, position }: TBannerView, device?: "desktop" | "phone"): string => {
  const { element } = style;
  const button = style.button ?? element;
  const phonePlacement = position.phone ?? position.desktop;
  // What changes with the device: sizes, placement, and the 44 px touch targets on phones.
  const barCss = (isPhone: boolean): string =>
    `${deviceSizeCss(isPhone ? element.phone : element.desktop)};${bannerPlacementCss(isPhone ? phonePlacement : position.desktop)}`;
  const buttonCss = (isPhone: boolean): string =>
    `${deviceSizeCss(isPhone ? button.phone : button.desktop)}${isPhone ? ";min-height:44px" : ""}`;
  const dismissCss = (isPhone: boolean): string =>
    `width:${isPhone ? 44 : 32}px;height:${isPhone ? 44 : 32}px`;
  const isPhone = device === "phone";

  return withSharedCss(
    style,
    `.fb-creative-banner{all:initial;box-sizing:border-box;display:flex;align-items:center;gap:8px;font-family:${style.pageFont ? "inherit" : SURVEY_FONT};font-weight:${element.fontWeight};line-height:1.5;border-style:solid;${barColorsCss(element.light)};${barCss(isPhone)}}` +
      `.fb-creative-banner[data-appearance=dark]{${barColorsCss(element.dark)}}` +
      `.fb-creative-banner-content{display:flex;flex:1;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 16px;min-width:0}` +
      `.fb-creative-banner-message{margin:0;text-align:center;white-space:pre-line;overflow-wrap:anywhere}` +
      `.fb-creative-banner a{color:inherit;text-decoration:underline}` +
      `.fb-creative-banner-button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;cursor:pointer;line-height:1.25;font-weight:${button.fontWeight};border-radius:${button.borderRadius}px;${colorsCss(button.light)};${buttonCss(isPhone)}}` +
      `.fb-creative-banner[data-appearance=dark] .fb-creative-banner-button{${colorsCss(button.dark)}}` +
      `.fb-creative-banner-dismiss{all:unset;box-sizing:border-box;display:inline-flex;flex:none;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;${dismissCss(isPhone)}}` +
      // Every control sits on the bar, so its focus ring takes the bar's text colour.
      `.fb-creative-banner :focus-visible{outline:2px solid ${element.light.textColor};outline-offset:2px}` +
      `.fb-creative-banner[data-appearance=dark] :focus-visible{outline-color:${element.dark.textColor}}` +
      (device
        ? ""
        : `@media ${CREATIVE_PHONE_MEDIA}{.fb-creative-banner{${barCss(true)}}.fb-creative-banner-button{${buttonCss(true)}}.fb-creative-banner-dismiss{${dismissCss(true)}}}`),
    ";display:block"
  );
};

/** What a banner region is called when its author set no Accessible name. */
const DEFAULT_BANNER_NAME = "Site notice";

/** A site can reserve the In page banners' place with this element, so the page doesn't shift. */
const BANNER_SLOT = "[data-formbricks-slot=banner-top]";

/** The link schemes banner text allows (`CreativeTextRun.href`); anything else stays plain text. */
const SAFE_HREF = /^(?:https?:\/\/|mailto:|tel:|\/(?!\/))/i;

/**
 * Banner text as DOM nodes, never as HTML: each run is a text node inside its formatting elements, and
 * consecutive runs with the same link share one link.
 */
const drawMessage = (doc: Document, runs: readonly TCreativeTextRun[]): HTMLElement => {
  const message = doc.createElement("p");
  message.className = "fb-creative-banner-message";
  let link: HTMLAnchorElement | null = null;

  for (const { text, bold, italic, underline, href } of runs) {
    let node: Node = doc.createTextNode(text);
    for (const [tag, isSet] of [
      ["u", underline],
      ["em", italic],
      ["strong", bold],
    ] as const) {
      if (!isSet) continue;
      const wrapper = doc.createElement(tag);
      wrapper.append(node);
      node = wrapper;
    }

    const safeHref = href && SAFE_HREF.test(href) ? href : null;
    if (safeHref && link?.getAttribute("href") !== safeHref) {
      link = doc.createElement("a");
      link.href = safeHref;
      message.append(link);
    } else if (!safeHref) {
      link = null;
    }
    (link ?? message).append(node);
  }
  return message;
};

const SVG_NS = "http://www.w3.org/2000/svg";

const drawButton = (doc: Document, className: string, onPress: () => void): HTMLButtonElement => {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = className;
  button.addEventListener("click", onPress);
  return button;
};

const setAttributes = (element: Element, attributes: Record<string, string>): void => {
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
};

/**
 * A 24 × 24 line icon drawn in the text colour. Decorative: the control it sits in is named by its
 * text or its `aria-label`, never by the icon.
 */
const drawIcon = (doc: Document, d: string, attributes: Record<string, string>): SVGSVGElement => {
  const icon = doc.createElementNS(SVG_NS, "svg");
  setAttributes(icon, {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    ...attributes,
  });
  const path = doc.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  icon.append(path);
  return icon;
};

/** The dismiss control: an X drawn in the text colour, named "Dismiss" for screen readers. */
const drawDismiss = (doc: Document, onDismiss: () => void): HTMLButtonElement => {
  const dismiss = drawButton(doc, "fb-creative-banner-dismiss", onDismiss);
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.append(drawIcon(doc, "M18 6 6 18M6 6l12 12", { width: "16", height: "16" }));
  return dismiss;
};

const drawBanner = (
  doc: Document,
  view: TBannerView,
  onClick: () => void,
  onDismiss: () => void
): HTMLElement => {
  const bar = doc.createElement("div");
  bar.className = CREATIVE_ROOT_CLASS.banner;
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", view.accessibleName || DEFAULT_BANNER_NAME);

  const content = doc.createElement("div");
  content.className = "fb-creative-banner-content";
  content.append(drawMessage(doc, view.message));
  if (view.buttonLabel !== null) {
    const button = drawButton(doc, "fb-creative-banner-button", onClick);
    button.textContent = view.buttonLabel;
    content.append(button);
  }
  bar.append(content);
  if (view.dismissible) bar.append(drawDismiss(doc, onDismiss));
  return bar;
};

/** A real button whose accessible name is its label, with the optional icon before it. */
const drawFeedbackButton = (doc: Document, view: TFeedbackButtonView, onClick: () => void): HTMLElement => {
  const button = drawButton(doc, CREATIVE_ROOT_CLASS.feedbackButton, onClick);
  if (view.icon) {
    button.append(drawIcon(doc, CREATIVE_ICON_PATHS[view.icon], { class: "fb-creative-button-icon" }));
  }
  button.append(view.label);
  return button;
};

/**
 * Draws a creative into its own shadow root (ADR 0003): `:host { all: initial }` keeps the page's
 * inherited styles out, sizes are px so the page's root font size can't scale them, and only the
 * creative's own CSS enters. Returns the host element it added; remove it to take the creative off the
 * page. Nothing is focused, animated or announced: a creative never takes the visitor's focus.
 *
 * A feedback button goes at the end of `root`; a banner at its start, so In page banners sit at the top
 * of the page flow and every notice comes first in reading order. Without a `root`, a banner goes into
 * the site's `[data-formbricks-slot="banner-top"]` element when there is one, else into `<body>`.
 */
export const render = (
  view: TCreativeView,
  { onClick, onDismiss = () => undefined, nonce, root, appearance = "light", device }: TRenderOptions
): HTMLElement => {
  const isBanner = view.type === "banner";

  const parent =
    root ?? (isBanner ? document.querySelector<HTMLElement>(BANNER_SLOT) : null) ?? document.body;
  const doc = parent.ownerDocument;
  const host = doc.createElement("div");
  host.setAttribute("data-formbricks-creative", view.id);
  const shadow = host.attachShadow({ mode: "open" });

  const style = doc.createElement("style");
  if (nonce) style.setAttribute("nonce", nonce);
  style.textContent = isBanner ? bannerCss(view, device) : feedbackButtonCss(view, device);

  const element = isBanner
    ? drawBanner(doc, view, onClick, onDismiss)
    : drawFeedbackButton(doc, view, onClick);
  // The dark palette and the creative's dark CSS key on it (`[data-appearance=dark]`), as on `#fbjs`.
  element.setAttribute("data-appearance", appearance);

  shadow.append(style, element);
  if (isBanner) parent.prepend(host);
  else parent.append(host);
  return host;
};
