"use client";

import { QueryClient, useQuery } from "@tanstack/react-query";
import { ChangeEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TSurveyAppearance } from "@formbricks/types/appearance";
import { TCustomCss } from "@formbricks/types/custom-css";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Button } from "@/modules/ui/components/button";
import { Textarea } from "@/modules/ui/components/textarea";

interface CustomCssCardProps {
  workspaceId: string;
  surveyId?: string;
  value: TCustomCss | null | undefined;
  workspaceCss?: TCustomCss | null;
  appearance: TSurveyAppearance;
  onChange: (value: TCustomCss) => void;
  disabledReason?: "plan" | "role";
}

interface ValidationResult {
  compiled: TCustomCss | null;
  removed: { message: string; line: number; column: number; appearance: TSurveyAppearance }[];
}

export const CustomCssCard = ({
  workspaceId,
  surveyId,
  value,
  workspaceCss,
  appearance,
  onChange,
  disabledReason,
}: Readonly<CustomCssCardProps>) => {
  const { t } = useTranslation();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadVersion = useRef(0);
  const [fileError, setFileError] = useState<string>();
  const [queryClient] = useState(() => new QueryClient());
  const light = value?.light?.source ?? "";
  const dark = value?.dark?.source ?? "";
  const source = appearance === "dark" ? dark : light;
  const sourceKey = JSON.stringify({ light, dark });
  const debouncedKey = useDebouncedValue(sourceKey, 300);
  const limit = surveyId ? 20 : 100;
  const byteCount = new TextEncoder().encode(light + dark).byteLength;
  const isTooLarge = byteCount > limit * 1024;
  const disabled = !!disabledReason;
  useEffect(() => {
    uploadVersion.current += 1;
  }, [appearance]);
  const validation = useQuery(
    {
      queryKey: ["custom-css-validation", workspaceId, surveyId, debouncedKey],
      enabled: !disabled && !isTooLarge && !!value,
      retry: false,
      refetchOnWindowFocus: false,
      gcTime: 0,
      queryFn: async ({ signal }): Promise<ValidationResult> => {
        const response = await fetch("/api/custom-css/validations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            surveyId,
            scope: surveyId ? "survey" : "workspace",
            ...JSON.parse(debouncedKey),
          }),
          signal,
        });
        const result = await response.json();
        if (!response.ok || !result.data) {
          throw new Error(
            typeof result.detail === "string" ? result.detail : t("styling.css_validation_failed")
          );
        }
        return result.data;
      },
    },
    queryClient
  );

  useEffect(() => {
    if (!validation.data) return;
    const accepted = validation.data.compiled ?? { light: null, dark: null, processorVersion: 1 };
    // A delayed response must never replace a newer edit, including an edit in the other appearance.
    if (
      sourceKey !== debouncedKey ||
      (accepted.light?.source ?? "") !== light ||
      (accepted.dark?.source ?? "") !== dark
    )
      return;
    if (JSON.stringify(value) !== JSON.stringify(accepted)) onChange(accepted);
  }, [validation.data, sourceKey, debouncedKey, value, light, dark, onChange]);

  const updateSource = (next: string) => {
    uploadVersion.current += 1;
    setFileError(undefined);
    onChange({
      light: value?.light ?? null,
      dark: value?.dark ?? null,
      processorVersion: value?.processorVersion ?? 1,
      [appearance]: { source: next, compiled: value?.[appearance]?.compiled ?? "" },
    });
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const version = ++uploadVersion.current;
    if (!file.name.toLowerCase().endsWith(".css") || file.size > limit * 1024) {
      setFileError(t("styling.css_file_error"));
      return;
    }
    try {
      const uploadedSource = await file.text();
      if (version === uploadVersion.current) updateSource(uploadedSource);
    } catch {
      if (version === uploadVersion.current) setFileError(t("styling.css_read_error"));
    }
  };

  const pending = sourceKey !== debouncedKey || validation.isFetching;
  const removed = sourceKey === debouncedKey ? (validation.data?.removed ?? []) : [];
  return (
    <section
      className="space-y-4 rounded-lg border border-slate-300 bg-white p-4"
      aria-labelledby={`${id}-title`}>
      <div>
        <h3 id={`${id}-title`} className="font-semibold text-slate-800">
          {t("styling.custom_css")}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{t("styling.custom_css_description")}</p>
        <p className="mt-1 text-xs text-slate-500">{t("styling.custom_css_overrides")}</p>
      </div>
      {workspaceCss && (workspaceCss.light?.source || workspaceCss.dark?.source) && (
        <details className="rounded border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t("styling.workspace_css")}</summary>
          <p className="my-2 text-xs text-slate-500">{t("styling.workspace_css_description")}</p>
          <pre className="max-h-48 overflow-auto text-xs whitespace-pre-wrap">
            {workspaceCss.light?.source}
            {appearance === "dark" ? `\n${workspaceCss.dark?.source ?? ""}` : ""}
          </pre>
        </details>
      )}
      {disabledReason && (
        <p className="rounded bg-slate-50 p-3 text-sm text-slate-600">
          {disabledReason === "plan" ? t("styling.css_plan_required") : t("styling.css_workspace_permission")}
        </p>
      )}
      <div className="space-y-2">
        <label htmlFor={`${id}-source`} className="text-sm font-medium text-slate-700">
          {t("styling.css_source", {
            appearance: appearance === "dark" ? t("styling.dark") : t("styling.light"),
          })}
        </label>
        <Textarea
          id={`${id}-source`}
          value={source}
          onChange={(event) => updateSource(event.target.value)}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-48 resize-y font-mono text-xs"
          isInvalid={isTooLarge || validation.isError}
          aria-describedby={`${id}-help`}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".css,text/css"
            onChange={upload}
            disabled={disabled}
            aria-label={t("styling.upload_css")}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}>
            {t("styling.upload_css")}
          </Button>
          <p id={`${id}-help`} className="text-xs text-slate-500">
            {t("styling.css_limit", { limit })}
          </p>
        </div>
      </div>
      {pending && !disabled && (
        <p role="status" className="text-xs text-slate-500">
          {t("styling.css_validating")}
        </p>
      )}
      {(fileError || isTooLarge || validation.isError) && (
        <p role="alert" className="text-sm text-red-700">
          {fileError ??
            (isTooLarge
              ? t("styling.css_file_error")
              : (validation.error?.message ?? t("styling.css_invalid")))}
        </p>
      )}
      {removed.length > 0 && (
        <div role="status" className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          <p>{t("styling.css_removed")}</p>
          <ul className="mt-2 list-inside list-disc">
            {removed.map((item, index) => (
              <li key={`${item.appearance}-${item.line}-${item.column}-${index}`}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}
      {appearance === "dark" && light && !dark && /(?:color|background)\s*:/i.test(light) && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">{t("styling.css_dark_hint")}</p>
      )}
    </section>
  );
};
