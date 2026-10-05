"use client";

import { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { STYLING_COLOR_KEYS, deriveDarkColors, getDarkContrastWarnings } from "@formbricks/types/appearance";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { useStylingAppearance } from "@/modules/ui/components/styling-appearance";

interface ColorFieldProps {
  form: UseFormReturn<TWorkspaceStyling | TSurveyStyling>;
  name: `${(typeof STYLING_COLOR_KEYS)[number]}.light`;
  label: string;
  description?: string;
  containerClass?: string;
}

export const ColorField = ({ form, name, label, description, containerClass }: Readonly<ColorFieldProps>) => {
  const appearance = useStylingAppearance();
  const { t } = useTranslation();
  const key = name.split(".")[0] as (typeof STYLING_COLOR_KEYS)[number];
  const styling = form.watch();
  const derived = appearance === "dark" ? deriveDarkColors(styling)[key] : undefined;
  const warning =
    appearance === "dark" ? getDarkContrastWarnings(styling).find((item) => item.field === key) : undefined;
  return (
    <FormField
      key={`${key}.${appearance}`}
      control={form.control}
      name={`${key}.${appearance}`}
      render={({ field }) => (
        <FormItem className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FormLabel>{label}</FormLabel>
            {appearance === "dark" &&
              (field.value == null ? (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {t("styling.derived")}
                </span>
              ) : (
                <button
                  type="button"
                  className="text-xs text-slate-600 underline"
                  onClick={() => field.onChange(null)}>
                  {t("styling.use_derived")}
                </button>
              ))}
          </div>
          {description && <FormDescription>{description}</FormDescription>}
          <FormControl>
            <ColorPicker
              aria-label={label}
              color={field.value ?? derived ?? ""}
              onChange={(color) => field.onChange(color)}
              containerClass={containerClass || "w-full"}
            />
          </FormControl>
          {warning && (
            <p role="status" className="text-xs text-amber-700">
              {t("styling.contrast_warning", { ratio: warning.ratio.toFixed(1), minimum: warning.minimum })}
            </p>
          )}
        </FormItem>
      )}
    />
  );
};
