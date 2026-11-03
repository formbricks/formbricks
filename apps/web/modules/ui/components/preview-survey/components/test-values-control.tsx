"use client";

import { FlaskConicalIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

interface TestValuesControlProps {
  /** The survey's URL parameters and hidden fields, by storage key. */
  readonly fields: string[];
  readonly values: Record<string, string>;
  /** Applies the values and restarts the preview with them. */
  readonly onApply: (values: Record<string, string>) => void;
}

/**
 * The preview's "Test values" control (ENG-6932, P15): values for URL parameters and hidden fields,
 * so rules before the first question can be tried without leaving the editor. Empty by default; the
 * values are edited as a draft and applied together, because applying restarts the preview.
 */
export const TestValuesControl = ({ fields, values, onApply }: TestValuesControlProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(values);
  const activeCount = Object.values(values).filter((value) => value.trim() !== "").length;

  if (fields.length === 0) return null;

  const apply = (next: Record<string, string>) => {
    onApply(next);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) setDraft(values);
      }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          id="preview-test-values"
          className={cn(
            "mr-1 h-fit bg-white px-2 py-0 font-sans text-sm text-slate-500",
            activeCount > 0 && "text-slate-900"
          )}>
          {activeCount > 0
            ? t("workspace.surveys.edit.test_values_count", { count: activeCount })
            : t("workspace.surveys.edit.test_values")}
          <FlaskConicalIcon className="ml-2 size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            apply(draft);
          }}>
          <div>
            <p className="text-sm font-semibold text-slate-900">{t("workspace.surveys.edit.test_values")}</p>
            <p className="text-xs text-slate-500">{t("workspace.surveys.edit.test_values_description")}</p>
          </div>
          {fields.map((field) => (
            <div key={field} className="flex flex-col gap-1">
              <Label htmlFor={`preview-test-value-${field}`} className="font-mono text-xs">
                {field}
              </Label>
              <Input
                id={`preview-test-value-${field}`}
                value={draft[field] ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                className="h-8"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => apply({})}>
              {t("common.clear")}
            </Button>
            <Button type="submit" size="sm">
              {t("workspace.surveys.edit.test_values_apply")}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};
