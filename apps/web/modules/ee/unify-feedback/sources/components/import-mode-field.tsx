"use client";

import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TFeedbackSourceImportMode } from "@formbricks/types/feedback-source";
import { cn } from "@/lib/cn";
import { FormControl, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import { TFormbricksFeedbackSourceForm } from "../types";

interface ImportModeFieldProps {
  control: Control<TFormbricksFeedbackSourceForm>;
  disabled?: boolean;
}

/**
 * Which responses this source imports: completed only, or partials too.
 *
 * Shared by the create and edit dialogs — unlike `importHistorical`, which is a one-shot toggle for
 * the create dialog, this is persisted on the source and has to round-trip on edit.
 *
 * Deliberately a radio group rather than a switch: "all" carries a privacy consequence the user has
 * to be able to read before choosing it, and a switch has nowhere to put that.
 */
export const ImportModeField = ({ control, disabled = false }: Readonly<ImportModeFieldProps>) => {
  const { t } = useTranslation();

  // Built here, with literal keys, rather than hoisted to a module constant holding key strings:
  // scan-translations resolves t() calls statically, so `t(option.labelKey)` reads as four unused
  // keys and fails the i18n check.
  const options: { value: TFeedbackSourceImportMode; label: string; description: string }[] = [
    {
      value: "completedOnly",
      label: t("workspace.unify.import_mode_completed_only"),
      description: t("workspace.unify.import_mode_completed_only_description"),
    },
    {
      value: "all",
      label: t("workspace.unify.import_mode_all"),
      description: t("workspace.unify.import_mode_all_description"),
    },
  ];

  return (
    <FormField
      control={control}
      name="importMode"
      render={({ field }) => (
        <FormItem className={cn("rounded-md border border-slate-200 p-3", disabled && "opacity-70")}>
          <FormLabel>{t("workspace.unify.import_mode_label")}</FormLabel>
          <FormControl>
            <RadioGroup
              className="mt-2 gap-y-3"
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              aria-label={t("workspace.unify.import_mode_label")}>
              {options.map((option) => (
                <div key={option.value} className="flex items-start gap-3">
                  <RadioGroupItem
                    className="mt-1 shrink-0"
                    value={option.value}
                    id={`import-mode-${option.value}`}
                  />
                  <label htmlFor={`import-mode-${option.value}`} className="cursor-pointer space-y-1">
                    <span className="block text-sm font-medium text-slate-800">{option.label}</span>
                    <span className="block text-sm text-slate-500">{option.description}</span>
                  </label>
                </div>
              ))}
            </RadioGroup>
          </FormControl>
        </FormItem>
      )}
    />
  );
};
