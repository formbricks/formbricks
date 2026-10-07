"use client";

import { AlertTriangleIcon, MoonIcon, SunIcon } from "lucide-react";
import { type ReactNode, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { type TDarkContrastWarning, getDarkContrastWarnings } from "@formbricks/types/dark-palette";
import { type TBaseStyling } from "@formbricks/types/styling";
import { cn } from "@/lib/cn";
import { type TStylingAppearance } from "@/lib/styling/dark-mode";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
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
}

/**
 * The Light / Dark selector at the top of the styling editor (D14). Dark switches every color picker
 * to its dark slot and the preview to the dark app survey.
 */
export const StylingAppearanceToggle = ({ appearance, onChange }: Readonly<StylingAppearanceToggleProps>) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <TabToggle
        id="styling-appearance"
        options={[
          { value: "light", label: t("workspace.look.appearance_light") },
          { value: "dark", label: t("workspace.look.appearance_dark") },
        ]}
        value={appearance}
        onChange={onChange}
      />
      {appearance === "dark" && (
        <Alert variant="info" size="small">
          <AlertDescription className="whitespace-normal">
            {t("workspace.look.appearance_dark_description")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

/** Sun / moon switch under a styling preview; drives the same appearance as the Light / Dark toggle. */
export const PreviewAppearanceSwitch = ({ appearance, onChange }: Readonly<StylingAppearanceToggleProps>) => {
  const { t } = useTranslation();

  return (
    <div className="flex rounded-full border-2 border-slate-300 p-1">
      {(
        [
          ["light", SunIcon, t("workspace.look.appearance_light")],
          ["dark", MoonIcon, t("workspace.look.appearance_dark")],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          aria-pressed={appearance === value}
          title={label}
          className={cn(
            "cursor-pointer rounded-full px-3 py-1 text-slate-700",
            appearance === value && "bg-slate-200"
          )}
          onClick={() => onChange(value)}>
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
};

// Long enough to outlast a drag in the color picker, short enough to read as a response to it.
const WARNINGS_SETTLE_MS = 400;

/**
 * The brand colors that are hard to see on the dark card (D12: we warn, we never change a typed
 * color). Rendered below the color pickers and only once the colors stop changing: recomputed on
 * every picker move, a warning crossing its threshold would appear and vanish mid-drag and shift the
 * picker under the pointer.
 */
export const DarkContrastWarnings = ({
  appearance,
  styling,
}: Readonly<{ appearance: TStylingAppearance; styling: TBaseStyling }>) => {
  const { t } = useTranslation();
  const current = appearance === "dark" ? getDarkContrastWarnings(styling) : [];
  // Debounce a string, not the array: the form hands over a new object on every render.
  const settled = useDebouncedValue(JSON.stringify(current), WARNINGS_SETTLE_MS);
  // Leaving Dark hides them at once rather than after the delay.
  const warnings: TDarkContrastWarning[] = appearance === "dark" ? JSON.parse(settled) : [];

  const labels: Record<TDarkContrastWarning["key"], string> = {
    brandColor: t("workspace.surveys.edit.brand_color"),
    buttonBgColor: t("workspace.look.advanced_styling_field_button_bg"),
    buttonTextColor: t("workspace.look.advanced_styling_field_button_text"),
    progressIndicatorBgColor: t("workspace.look.advanced_styling_field_indicator_bg"),
  };

  // The brand color is shared by both appearances, and button text is measured against the button
  // rather than the card, so each gets its own wording. Literal keys keep the i18n scanner happy.
  const getMessage = (warning: TDarkContrastWarning): string => {
    const values = { field: labels[warning.key], ratio: warning.ratio.toFixed(1) };
    if (warning.key === "brandColor")
      return t("workspace.look.appearance_dark_contrast_warning_shared", values);
    if (warning.key === "buttonTextColor") {
      return t("workspace.look.appearance_dark_contrast_warning_button_text", values);
    }
    return t("workspace.look.appearance_dark_contrast_warning", values);
  };

  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <output
          key={warning.key}
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{getMessage(warning)}</span>
        </output>
      ))}
    </div>
  );
};
