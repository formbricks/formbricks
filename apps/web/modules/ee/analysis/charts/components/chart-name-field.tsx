"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";

interface ChartNameFieldProps {
  /** The footer's Save reaches this form through the `form` attribute, so it needs a stable id. */
  formId: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * The name leads the rail: it is what gates saving, it is the one field the AI path arrives with
 * already filled in, and it reads as the first thing you set rather than as chrome bolted onto the
 * header. The validation message lives here too — nothing outside needs to know about it.
 */
export function ChartNameField({ formId, value, onChange, onSubmit }: Readonly<ChartNameFieldProps>) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        onSubmit();
      }}
      className="flex flex-col gap-2">
      <Label htmlFor="create-chart-name" className={cn(error && "text-red-500")}>
        {t("workspace.analysis.charts.chart_name")}
      </Label>
      <Input
        id="create-chart-name"
        value={value}
        onChange={(event) => {
          setError(null);
          onChange(event.target.value);
        }}
        onInvalid={(event) => {
          // Suppress the browser tooltip and render our inline message instead.
          event.preventDefault();
          event.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
          event.currentTarget.focus();
          setError(t("workspace.analysis.charts.please_enter_chart_name"));
        }}
        placeholder={t("workspace.analysis.charts.chart_name_placeholder")}
        maxLength={255}
        required
        isInvalid={!!error}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
