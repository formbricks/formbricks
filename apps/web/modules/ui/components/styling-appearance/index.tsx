"use client";

import { AlertTriangleIcon } from "lucide-react";
import { type ReactNode, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { getDarkContrastWarnings } from "@formbricks/types/dark-palette";
import { type TBaseStyling } from "@formbricks/types/styling";
import { type TStylingAppearance } from "@/lib/styling/dark-mode";
import { TabToggle } from "@/modules/ui/components/tab-toggle";

const StylingAppearanceContext = createContext<TStylingAppearance>("light");

/** Which palette the styling form edits. Fields outside a provider edit light, as before. */
export const useStylingAppearance = (): TStylingAppearance => useContext(StylingAppearanceContext);

export const StylingAppearanceProvider = ({
  appearance,
  children,
}: Readonly<{ appearance: TStylingAppearance; children: ReactNode }>) => (
  <StylingAppearanceContext.Provider value={appearance}>{children}</StylingAppearanceContext.Provider>
);

interface StylingAppearanceToggleProps {
  appearance: TStylingAppearance;
  onChange: (appearance: TStylingAppearance) => void;
  /** The form's current values; only the color fields are read for the contrast warnings. */
  styling: TBaseStyling;
}

/**
 * The Light / Dark selector at the top of the styling editor (D14). Dark switches every color picker
 * to its dark slot and the preview to the dark app survey, and lists the brand colors that are hard
 * to see on the dark card (D12: we warn, we never change a typed color).
 */
export const StylingAppearanceToggle = ({
  appearance,
  onChange,
  styling,
}: Readonly<StylingAppearanceToggleProps>) => {
  const { t } = useTranslation();
  const warnings = appearance === "dark" ? getDarkContrastWarnings(styling) : [];

  const labels: Record<(typeof warnings)[number]["key"], string> = {
    brandColor: t("workspace.surveys.edit.brand_color"),
    buttonBgColor: t("workspace.look.advanced_styling_field_button_bg"),
    buttonTextColor: t("workspace.look.advanced_styling_field_button_text"),
    progressIndicatorBgColor: t("workspace.look.advanced_styling_field_indicator_bg"),
  };

  return (
    <div className="space-y-2">
      <TabToggle
        id="styling-appearance"
        options={[
          { value: "light", label: t("workspace.look.appearance_light") },
          { value: "dark", label: t("workspace.look.appearance_dark") },
        ]}
        defaultSelected={appearance}
        onChange={onChange}
      />
      {appearance === "dark" && (
        <p className="text-xs text-slate-500">{t("workspace.look.appearance_dark_description")}</p>
      )}
      {warnings.map((warning) => (
        <output
          key={warning.key}
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {t("workspace.look.appearance_dark_contrast_warning", {
              field: labels[warning.key],
              ratio: warning.ratio.toFixed(1),
            })}
          </span>
        </output>
      ))}
    </div>
  );
};
