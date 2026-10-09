"use client";

import { useTranslation } from "react-i18next";
import { BRAND_PRESERVED_COLOR_KEYS } from "@formbricks/types/dark-palette";
import { type TBaseStyling } from "@formbricks/types/styling";
import { STYLE_DEFAULTS } from "@/lib/styling/constants";
import {
  getAppearanceFieldName,
  getColorKey,
  getDarkDisplayColor,
  isSharedColorField,
} from "@/lib/styling/dark-mode";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { useStylingAppearance } from "@/modules/ui/components/styling-appearance";

interface ColorFieldProps {
  form: any;
  name: string;
  label: string;
  description?: string;
  containerClass?: string;
  /** Shown when the field has no value (light mode). */
  fallbackColor?: string;
}

/**
 * A styling color picker bound to `<field>.light`. In the Dark tab it edits `<field>.dark`: an
 * unset dark value shows the color respondents will see (derived, or the light value for brand
 * colors) and "Use automatic" clears an override back to it (D2, ENG-2945).
 */
export const ColorField = ({
  form,
  name,
  label,
  description,
  containerClass,
  fallbackColor,
}: Readonly<ColorFieldProps>) => {
  const { t } = useTranslation();
  const appearance = useStylingAppearance();
  const fieldName = getAppearanceFieldName(name, appearance);
  const isDark = fieldName !== name;
  // The brand color has one value for both appearances; the Dark tab edits it and says so.
  const isShared = appearance === "dark" && isSharedColorField(name);
  const darkDisplayColor = isDark ? getDarkDisplayColor(form.watch() as TBaseStyling, name) : undefined;
  // Brand colors keep their light value in dark unless overridden (D12); everything else derives.
  const isBrandColor = (BRAND_PRESERVED_COLOR_KEYS as readonly string[]).includes(getColorKey(name) ?? "");

  // A color object always needs `light` (ZStylingColor). Styling saved before a field existed can
  // lack it, so a dark edit fills the light slot with its default instead of failing validation.
  const setDarkValue = (onChange: (value: string | null) => void, value: string | null) => {
    const key = getColorKey(name);
    if (key && !form.getValues(name)) {
      const defaultLight = fallbackColor ?? STYLE_DEFAULTS[key]?.light;
      if (defaultLight) form.setValue(name, defaultLight);
    }
    onChange(value);
  };

  return (
    <FormField
      key={fieldName}
      control={form.control}
      name={fieldName}
      render={({ field }) => (
        <FormItem className="space-y-1">
          <FormLabel>{label}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}
          <FormControl>
            <ColorPicker
              // In dark an unset field stays empty and shows the color respondents get as a placeholder,
              // so an override and an automatic color are told apart at a glance.
              color={field.value || (isDark ? "" : fallbackColor) || ""}
              placeholderColor={isDark ? darkDisplayColor : undefined}
              onChange={(color) => (isDark ? setDarkValue(field.onChange, color) : field.onChange(color))}
              containerClass={containerClass || "w-full"}
            />
          </FormControl>
          {isShared && (
            <p className="text-xs text-slate-500">{t("workspace.look.appearance_shared_color")}</p>
          )}
          {isDark && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {field.value ? (
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-slate-700"
                  onClick={() => setDarkValue(field.onChange, null)}>
                  {t("workspace.look.appearance_use_automatic")}
                </button>
              ) : (
                <span>
                  {isBrandColor
                    ? t("workspace.look.appearance_automatic_same_as_light")
                    : t("workspace.look.appearance_automatic")}
                </span>
              )}
            </div>
          )}
        </FormItem>
      )}
    />
  );
};
