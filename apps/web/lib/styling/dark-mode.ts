import { SHARED_COLOR_KEYS, type TStylingColorKey, resolveDarkColors } from "@formbricks/types/dark-palette";
import { type TStylingColor } from "@formbricks/types/styling";

export type TStylingAppearance = "light" | "dark";

type TColorStyling = Partial<Record<TStylingColorKey, TStylingColor | null | undefined>>;

/** Whether a color path has one value for light and dark (the brand color). */
export const isSharedColorField = (name: string): boolean =>
  (SHARED_COLOR_KEYS as readonly string[]).includes(getColorKey(name) ?? "");

/**
 * The styling form binds color pickers to `<field>.light`. In the Dark tab the same picker edits
 * `<field>.dark` instead, so light values are never touched while editing dark (D14). Shared colors
 * keep editing their one value.
 */
export const getAppearanceFieldName = (name: string, appearance: TStylingAppearance): string =>
  appearance === "dark" && name.endsWith(".light") && !isSharedColorField(name)
    ? `${name.slice(0, -".light".length)}.dark`
    : name;

export const getColorKey = (name: string): TStylingColorKey | undefined => {
  const [key, mode] = name.split(".");
  return mode === "light" || mode === "dark" ? (key as TStylingColorKey) : undefined;
};

/**
 * What a dark picker shows when the creator has not set a dark value: the light value for brand
 * colors (D12), otherwise the value derived from the brand color. Same resolver as the renderer, so
 * the editor shows exactly what respondents will see.
 */
export const getDarkDisplayColor = (styling: TColorStyling, name: string): string | undefined => {
  const key = getColorKey(name);
  return key ? resolveDarkColors(styling)[key] : undefined;
};
