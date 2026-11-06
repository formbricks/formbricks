/**
 * Where the typed-signature font is fetched from — `{appUrl}/js/fonts`, beside the renderer, set once
 * from the host app's `appUrl` before the first render (see `src/index.ts`).
 *
 * Absolute for the same reason as the locale bundles (see `i18n.config.ts`): the mobile SDKs render in a
 * WebView whose base URL is `about:blank`, where a root-relative path resolves to nothing. Empty until
 * set; the Signature element then draws typed names in the system cursive font.
 */
let fontBaseUrl = "";

export const SIGNATURE_FONT_FILE = "FormbricksSignatureScript-latin.woff2";

/**
 * Cache-busts the font against the bundle that asks for it: `/js/*` is cached at the CDN for 30 days, and
 * the token is a hash of the font files, injected at build time, so the URL changes only when they do.
 */
declare const __FB_FONTS_HASH__: string;
const fontsVersion = typeof __FB_FONTS_HASH__ === "string" ? __FB_FONTS_HASH__ : "dev";

export const setFontBaseUrl = (appUrl: string | undefined): void => {
  fontBaseUrl = `${appUrl ?? ""}/js/fonts`;
};

/** The typed-signature font's URL, or `undefined` before `setFontBaseUrl` has run. */
export const getSignatureFontUrl = (): string | undefined =>
  fontBaseUrl ? `${fontBaseUrl}/${SIGNATURE_FONT_FILE}?v=${fontsVersion}` : undefined;
