"use client";

import { useQuery } from "@tanstack/react-query";
import { PaperclipIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { EXPORT_ADVANCED_OPTIONS, type TExportFormat } from "@/lib/analysis-export/export-request";
import type { TAnswerDisplay } from "@/lib/analysis-export/types";
import { Button } from "@/modules/ui/components/button";
import { Checkbox } from "@/modules/ui/components/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Label } from "@/modules/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { fetchExportCounts } from "./export-client";
import { useExportManager } from "./export-manager";
import {
  DEFAULT_EXPORT_OPTIONS,
  type TExportOptions,
  excelAlternative,
  isExcelBlocked,
  isExcelTooLarge,
  isSpssAvailable,
  isTextOnlyAvailable,
  setDisplay,
  setFormat,
  setSpss,
  toExportRequest,
  toggleAdvanced,
} from "./export-options";

export type TExportScope = {
  /** The Responses filter in effect. Leave out for every response. */
  filter?: TResponseFilterCriteria;
  /** A selection of rows: replaces the filter. */
  responseIds?: string[];
};

type TExportModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  surveyId: string;
  scope: TExportScope;
  /** Offered when the survey collects files. Runs the attachments zip download for the same scope. */
  onDownloadAttachments?: () => void;
};

const Section = ({ title, children }: Readonly<{ title: string; children: ReactNode }>) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-sm font-medium text-slate-800">{title}</h3>
    {children}
  </section>
);

const RadioRow = ({
  id,
  value,
  label,
  disabled,
  disabledReason,
}: Readonly<{ id: string; value: string; label: string; disabled?: boolean; disabledReason?: string }>) => (
  <TooltipRenderer shouldRender={Boolean(disabled && disabledReason)} tooltipContent={disabledReason}>
    <div className="flex items-center gap-2">
      <RadioGroupItem id={id} value={value} disabled={disabled} />
      <Label htmlFor={id} className={disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
        {label}
      </Label>
    </div>
  </TooltipRenderer>
);

const CheckboxRow = ({
  id,
  checked,
  disabled,
  onCheckedChange,
  label,
  description,
}: Readonly<{
  id: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
}>) => (
  <div className="flex items-start gap-2">
    <Checkbox
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      className="mt-0.5"
    />
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className={disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
        {label}
      </Label>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </div>
  </div>
);

const ExportModalBody = ({
  surveyId,
  scope,
  onClose,
  onDownloadAttachments,
}: Readonly<Omit<TExportModalProps, "open" | "onOpenChange"> & { onClose: () => void }>) => {
  const { t } = useTranslation();
  const { startExport } = useExportManager();
  // Always the Standard defaults: the modal is mounted afresh on every open and keeps nothing.
  const [options, setOptions] = useState<TExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const request = toExportRequest(options, scope);

  const counts = useQuery({
    queryKey: ["survey-export-counts", surveyId, request],
    queryFn: ({ signal }) => fetchExportCounts({ surveyId, request, signal }),
    staleTime: 0,
    retry: false,
  });

  // Excel is built whole in memory, so a selection past the cap is switched off and CSV recommended.
  const excelTooLarge = isExcelTooLarge(counts.data);
  const excelBlocked = isExcelBlocked(options, counts.data);
  const alternative = excelAlternative(options);
  const excelSize = { cells: counts.data?.excel?.cells ?? 0, max: counts.data?.excel?.maxCells ?? 0 };
  const excelTooLargeMessage =
    alternative === "zip"
      ? t("workspace.surveys.export.excel_too_large_zip", excelSize)
      : t("workspace.surveys.export.excel_too_large_csv", excelSize);

  const displayChoices: { value: TAnswerDisplay; label: string }[] = [
    { value: "text", label: t("workspace.surveys.export.display_text") },
    { value: "codes", label: t("workspace.surveys.export.display_codes") },
    { value: "both", label: t("workspace.surveys.export.display_both") },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("workspace.surveys.export.modal_title")}</DialogTitle>
        <DialogDescription>{t("workspace.surveys.export.description")}</DialogDescription>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-5 py-2" data-testid="export-modal">
        <Section title={t("workspace.surveys.export.format_title")}>
          <RadioGroup
            className="flex gap-4"
            value={options.format}
            onValueChange={(value) => setOptions((current) => setFormat(current, value as TExportFormat))}>
            <RadioRow id="export-format-csv" value="csv" label={t("workspace.surveys.export.format_csv")} />
            <RadioRow
              id="export-format-xlsx"
              value="xlsx"
              label={t("workspace.surveys.export.format_excel")}
              disabled={excelTooLarge}
              disabledReason={excelTooLargeMessage}
            />
          </RadioGroup>
          {excelBlocked && (
            <div
              role="alert"
              data-testid="export-excel-too-large"
              className="flex flex-col items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>{excelTooLargeMessage}</p>
              <Button
                variant="secondary"
                size="sm"
                data-testid="export-excel-switch"
                onClick={() => setOptions((current) => setFormat(current, "csv"))}>
                {alternative === "zip"
                  ? t("workspace.surveys.export.excel_too_large_zip_switch")
                  : t("workspace.surveys.export.excel_too_large_csv_switch")}
              </Button>
            </div>
          )}
          <CheckboxRow
            id="export-spss"
            checked={options.spss}
            disabled={!isSpssAvailable(options)}
            onCheckedChange={(checked) => setOptions((current) => setSpss(current, checked))}
            label={t("workspace.surveys.export.spss_label")}
            description={t("workspace.surveys.export.spss_description")}
          />
        </Section>

        <Section title={t("workspace.surveys.export.display_title")}>
          <RadioGroup
            className="flex flex-wrap gap-4"
            value={options.display}
            onValueChange={(value) => setOptions((current) => setDisplay(current, value as TAnswerDisplay))}>
            {displayChoices.map((choice) => (
              <RadioRow
                key={choice.value}
                id={`export-display-${choice.value}`}
                value={choice.value}
                label={choice.label}
                disabled={choice.value === "text" && !isTextOnlyAvailable(options)}
                disabledReason={t("workspace.surveys.export.display_text_disabled_spss")}
              />
            ))}
          </RadioGroup>
        </Section>

        <Section title={t("workspace.surveys.export.columns_title")}>
          <CheckboxRow
            id="export-columns-all"
            checked
            disabled
            onCheckedChange={() => undefined}
            label={t("workspace.surveys.export.columns_select_all")}
          />
        </Section>

        <Section title={t("workspace.surveys.export.advanced_options")}>
          {EXPORT_ADVANCED_OPTIONS.filter((option) => option.appliesTo.includes(options.format)).map(
            (option) => (
              <CheckboxRow
                key={option.id}
                id={`export-advanced-${option.id}`}
                checked={options.advanced.includes(option.id)}
                onCheckedChange={(checked) =>
                  setOptions((current) => toggleAdvanced(current, option.id, checked))
                }
                label={option.label(t)}
                description={option.description(t)}
              />
            )
          )}
        </Section>

        {onDownloadAttachments && (
          <Section title={t("workspace.surveys.export.attachments_title")}>
            <p className="text-xs text-slate-500">{t("workspace.surveys.export.attachments_description")}</p>
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => {
                onDownloadAttachments();
                onClose();
              }}>
              <PaperclipIcon />
              {t("workspace.surveys.export.attachments_download")}
            </Button>
          </Section>
        )}
      </DialogBody>

      <DialogFooter className="items-center sm:justify-between">
        <p className="text-sm text-slate-600" data-testid="export-count-line" aria-live="polite">
          {counts.data && (
            <>
              {t("workspace.surveys.export.count_include", { count: counts.data.included })}
              {counts.data.lowQualityLeftOut > 0 &&
                ` · ${t("workspace.surveys.export.count_low_quality_left_out", { count: counts.data.lowQualityLeftOut })}`}
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            data-testid="export-submit"
            disabled={excelBlocked}
            onClick={() => {
              startExport({ surveyId, request });
              onClose();
            }}>
            {t("workspace.surveys.export.button")}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
};

/**
 * The Export modal (replaces the Download dropdown). It builds a request from its controls and hands it
 * to the export manager, then closes: the export carries on in the survey layout.
 */
export const ExportModal = ({ open, onOpenChange, ...rest }: Readonly<TExportModalProps>) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent width="narrow">
      <ExportModalBody {...rest} onClose={() => onOpenChange(false)} />
    </DialogContent>
  </Dialog>
);
