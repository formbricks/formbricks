/*
 * The web SDK's creative renderer, for views that draw a creative as a visitor sees it.
 *
 * Only `render`, the default style and the types are used (the bundler drops the rest): they need no
 * network, no zod and no other workspace package, and `render` draws into a Shadow DOM from plain data,
 * which the MCP Apps sandbox allows under its default CSP (an inline `<style>` in the shadow root is
 * covered by `style-src 'unsafe-inline'`).
 */
export { CREATIVE_ROOT_CLASS, render } from "@formbricks/creatives";
export { DEFAULT_CREATIVE_STYLE } from "@formbricks/creatives";
export type {
  TBannerPlacement,
  TBannerView,
  TCreativeCustomCss,
  TCreativeDestination,
  TCreativeElementStyle,
  TCreativeIcon,
  TCreativePosition,
  TCreativeStyle,
  TCreativeTextRun,
  TCreativeView,
  TFeedbackButtonPlacement,
  TFeedbackButtonView,
} from "@formbricks/creatives";
