// The creatives renderer (ADR 0003): `resolve` decides what a page shows, `render` draws it. Bundled into
// js-core, so keep it small, zod-free and free of runtime dependencies (`import type` only).
export { resolveClick, type TCreativeClick } from "./click";
export { getClockOffset } from "./clock";
export {
  MAX_COUNTED_PAGE_LENGTH,
  MAX_CREATIVE_EVENTS_PER_REQUEST,
  type TCreativeEvent,
  type TCreativeEventType,
  type TCreativeEventsBody,
  getCountedPage,
} from "./events";
export { type TVisitorLanguage, matchLanguage } from "./language";
export {
  CREATIVE_INSET_PROPERTY,
  CREATIVE_PHONE_MEDIA,
  CREATIVE_ROOT_CLASS,
  render,
  type TRenderOptions,
} from "./render";
export {
  resolve,
  type TCreativePage,
  type TResolveInput,
  type TResolveResult,
  type TResolveSurvey,
} from "./resolve";
export { CREATIVE_SHARE_STORAGE_KEY, createShareRolls } from "./share";
export { DEFAULT_CREATIVE_STYLE } from "./style";
export type * from "./types";
