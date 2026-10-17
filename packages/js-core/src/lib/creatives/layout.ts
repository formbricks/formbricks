import {
  CREATIVE_INSET_PROPERTY,
  CREATIVE_PHONE_MEDIA,
  CREATIVE_ROOT_CLASS,
  type TCreativeView,
} from "@formbricks/creatives";

/**
 * How the creatives on a page share it (ENG-3576): same-position banners stack newest on top, and
 * feedback buttons keep clear of Overlay banners. `render` draws each creative on its own; this module
 * places them relative to each other, and does it again whenever a banner's size changes (a wrap on a
 * narrower window, a late web font, crossing the phone breakpoint).
 */

export interface TShownCreative {
  view: TCreativeView;
  host: HTMLElement;
}

let arranged: readonly TShownCreative[] = [];
let resizeObserver: ResizeObserver | null = null;

/**
 * Puts the banners' hosts in payload order, newest first. `render` adds every banner at the start of the
 * page, so a banner drawn after a newer one would otherwise end up above it. Only a host out of place
 * moves: moving one takes the focus out of it.
 */
const orderBanners = (): void => {
  let previous: HTMLElement | null = null;
  for (const { view, host } of arranged) {
    if (view.type !== "banner") continue;
    if (previous && previous.nextElementSibling !== host) previous.after(host);
    previous = host;
  }
};

const barOf = (host: HTMLElement): HTMLElement | null =>
  host.shadowRoot?.querySelector<HTMLElement>(`.${CREATIVE_ROOT_CLASS.banner}`) ?? null;

const setInset = (host: HTMLElement, edge: "top" | "bottom", px: number): void => {
  host.style.setProperty(CREATIVE_INSET_PROPERTY[edge], `${String(px)}px`);
};

/**
 * Each Overlay banner goes below the newer ones on its edge, and every feedback button gets the space
 * all of them take, so its offset runs along the rest of the edge. The placement that counts is the one
 * the viewport shows now: the phone one below 768 px.
 */
const stackOverlays = (): void => {
  const isPhone = typeof window.matchMedia === "function" && window.matchMedia(CREATIVE_PHONE_MEDIA).matches;
  const taken = { top: 0, bottom: 0 };

  for (const { view, host } of arranged) {
    if (view.type !== "banner") continue;
    const { placement, layout } = (isPhone ? view.position.phone : null) ?? view.position.desktop;
    if (layout !== "overlay") continue;
    setInset(host, placement, taken[placement]);
    taken[placement] += barOf(host)?.getBoundingClientRect().height ?? 0;
  }

  for (const { view, host } of arranged) {
    if (view.type === "banner") continue;
    setInset(host, "top", taken.top);
    setInset(host, "bottom", taken.bottom);
  }
};

/**
 * Lays out the creatives `reconcileCreatives` just drew, in payload order (newest first), and keeps
 * them laid out while the banners' sizes change.
 */
export const arrangeCreatives = (shown: readonly TShownCreative[]): void => {
  arranged = shown;
  orderBanners();
  stackOverlays();

  resizeObserver?.disconnect();
  if (typeof ResizeObserver !== "function") return;
  resizeObserver ??= new ResizeObserver(stackOverlays);
  for (const { host } of arranged) {
    const bar = barOf(host);
    if (bar) resizeObserver.observe(bar);
  }
};

/** Stops watching the banners' sizes, once every creative is off the page. */
export const stopArrangingCreatives = (): void => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  arranged = [];
};
