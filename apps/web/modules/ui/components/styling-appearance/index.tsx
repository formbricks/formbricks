"use client";

import { createContext, useContext, useId } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyAppearance } from "@formbricks/types/appearance";

export const StylingAppearanceContext = createContext<TSurveyAppearance>("light");
export const useStylingAppearance = () => useContext(StylingAppearanceContext);

export const StylingAppearanceToggle = ({
  appearance,
  onChange,
  disabled = false,
}: Readonly<{
  appearance: TSurveyAppearance;
  onChange: (value: TSurveyAppearance) => void;
  disabled?: boolean;
}>) => {
  const { t } = useTranslation();
  const id = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-800">{t("styling.appearance")}</legend>
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {(["light", "dark"] as const).map((value) => (
          <label
            key={value}
            className={`flex-1 cursor-pointer rounded-md px-4 py-2 text-center text-sm has-focus-visible:ring-2 has-focus-visible:ring-slate-600 ${appearance === value ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600"}`}>
            <input
              className="sr-only"
              type="radio"
              name={id}
              value={value}
              checked={appearance === value}
              disabled={disabled}
              onChange={() => onChange(value)}
            />
            {value === "dark" ? t("styling.dark") : t("styling.light")}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {appearance === "dark" ? t("styling.dark_description") : t("styling.light_description")}
      </p>
    </fieldset>
  );
};
