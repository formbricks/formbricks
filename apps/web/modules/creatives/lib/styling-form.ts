import type {
  BannerPlacementZodType,
  BannerStylingZodType,
  BannerThemeZodType,
  FeedbackButtonPlacementZodType,
  FeedbackButtonStylingZodType,
  FeedbackButtonThemeZodType,
} from "@formbricks/api-v3-schemas";
import type { TStylingAppearance } from "@/lib/styling/dark-mode";
import { normalizeCustomCssInput } from "@/modules/custom-css/components/lib/draft";
import type { TCreativeResource } from "./editor-form";
import type { TCreativeStyleSource } from "./style";

/**
 * The Styling tab's state (ENG-4005): the creative's v3 `styling` group, tagged with its type so the
 * position and the theme always match the creative. Position applies whether or not custom styles are
 * on; the theme's values are kept while "Add custom styles" is off but don't apply.
 */
export type TCreativeStylingForm =
  | {
      type: "feedbackButton";
      position: FeedbackButtonStylingZodType["position"];
      theme: FeedbackButtonThemeZodType;
    }
  | { type: "banner"; position: BannerStylingZodType["position"]; theme: BannerThemeZodType };

/** Which values the Styling tab edits and the preview draws: desktop, or phone below 768 px. */
export type TCreativeDevice = "desktop" | "phone";

export type TCreativeTheme = TCreativeStylingForm["theme"];

/** The per-device size fields; `null` on phone uses the desktop value, on desktop the workspace one. */
export type TCreativeSizeKey = "fontSize" | "paddingX" | "paddingY";

export const toStylingForm = (resource: TCreativeResource): TCreativeStylingForm =>
  resource.type === "feedbackButton"
    ? { type: "feedbackButton", position: resource.styling.position, theme: resource.styling.theme }
    : { type: "banner", position: resource.styling.position, theme: resource.styling.theme };

/** What `getCreativeStyle` computes the look from. */
export const toStyleSource = (styling: TCreativeStylingForm): TCreativeStyleSource =>
  styling.type === "feedbackButton"
    ? { type: "feedbackButton", styling: { theme: styling.theme } }
    : { type: "banner", styling: { theme: styling.theme } };

/**
 * The `styling` group a save sends, whole. Blank Custom CSS fields go out as none, and both blank as
 * no CSS at all, the same rule the server applies; an unset Font override goes out as `null`.
 */
export const toStylingBody = (
  styling: TCreativeStylingForm
): FeedbackButtonStylingZodType | BannerStylingZodType => {
  const normalize = <TTheme extends TCreativeTheme>(theme: TTheme): TTheme => ({
    ...theme,
    pageFont: theme.pageFont ?? null,
    customCss: normalizeCustomCssInput(theme.customCss),
  });
  if (styling.type === "feedbackButton") {
    return { position: styling.position, theme: normalize(styling.theme) };
  }
  return { position: styling.position, theme: normalize(styling.theme) };
};

export type TFeedbackButtonPlacement = FeedbackButtonPlacementZodType;
export type TBannerPlacement = BannerPlacementZodType;

export const withPosition = <TStyling extends TCreativeStylingForm>(
  styling: TStyling,
  position: TStyling["position"]
): TStyling => ({ ...styling, position });

/** Theme fields both types have; a feedback button's corner radius is set on its own. */
export type TSharedThemePatch = Partial<BannerThemeZodType>;

export const withTheme = <TStyling extends TCreativeStylingForm>(
  styling: TStyling,
  patch: TSharedThemePatch
): TStyling => ({ ...styling, theme: { ...styling.theme, ...patch } });

/** The theme's colours, each `{ light, dark? }` like the survey styling's, or `null` for the workspace's. */
export type TCreativeColorKey = "backgroundColor" | "textColor" | "borderColor";

/** The colour the author set for one appearance; `null` follows the workspace (light) or is derived (dark). */
export const getOwnColor = (
  theme: TCreativeTheme,
  key: TCreativeColorKey,
  appearance: TStylingAppearance
): string | null => theme[key]?.[appearance] ?? null;

/**
 * Sets one appearance's colour. Light: `null` hands the colour back to the workspace, its dark value with
 * it (a dark value needs a light one, as in the survey styling). Dark: `null` goes back to the derived
 * colour. A dark value on a colour left to the workspace takes `shownLight`, the light colour on screen,
 * as its light value so light looks as before (the survey's colour fields fill a missing light value the
 * same way); with nothing to take, a light that shows no border, it can't be set and this returns `null`.
 */
export const withColorValue = (
  theme: TCreativeTheme,
  key: TCreativeColorKey,
  appearance: TStylingAppearance,
  value: string | null,
  shownLight: string | null
): TSharedThemePatch | null => {
  const current = theme[key];
  const patch: TSharedThemePatch = {};
  if (appearance === "light") {
    patch[key] = value === null ? null : { light: value, dark: current?.dark ?? null };
    return patch;
  }
  const light = current?.light ?? shownLight;
  if (light === null) return null;
  patch[key] = { light, dark: value };
  return patch;
};

/** Sets one device's size value; `null` goes back to the desktop value (phone) or the workspace one. */
export const withSizeValue = (
  theme: TCreativeTheme,
  key: TCreativeSizeKey,
  device: TCreativeDevice,
  value: number | null
): TSharedThemePatch => {
  const current = theme[key];
  const patch: TSharedThemePatch = {};
  patch[key] =
    device === "phone"
      ? { desktop: current.desktop, phone: value }
      : { desktop: value, phone: current.phone };
  return patch;
};

/** The placement a device uses: the phone's own, or the desktop one when the phone has none. */
export const getDevicePlacement = <TPlacement>(
  position: { desktop: TPlacement; phone: TPlacement | null },
  device: TCreativeDevice
): TPlacement => (device === "phone" ? (position.phone ?? position.desktop) : position.desktop);

/** Sets one device's placement; `null` on phone goes back to the desktop one. */
export const withDevicePlacement = <TPlacement>(
  position: { desktop: TPlacement; phone: TPlacement | null },
  device: TCreativeDevice,
  placement: TPlacement | null
): { desktop: TPlacement; phone: TPlacement | null } =>
  device === "phone"
    ? { ...position, phone: placement }
    : { ...position, desktop: placement ?? position.desktop };

/**
 * A banner placement from the Edge and Layout controls. A bottom banner is always an overlay; a top one
 * is In page unless the author picked Overlay.
 */
export const toBannerPlacement = (
  edge: BannerPlacementZodType["placement"],
  layout: BannerPlacementZodType["layout"] = "inPage"
): BannerPlacementZodType =>
  edge === "bottom" ? { placement: "bottom", layout: "overlay" } : { placement: "top", layout };
