"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { useQuery } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  Loader2Icon,
  PaperclipIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import {
  type TExportColumnGroup,
  hasNoColumnSelected,
  selectAllState,
  toggleGroup,
  toggleSelectAll,
} from "@/lib/analysis-export/column-selection";
import { EXPORT_ADVANCED_OPTIONS, type TExportFormat } from "@/lib/analysis-export/export-request";
import type { TAnswerDisplay } from "@/lib/analysis-export/types";
import { cn } from "@/lib/cn";
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
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/modules/ui/components/select";
import { fetchExportCounts, formatBytes } from "./export-client";
import { useExportManager } from "./export-manager";
import {
  DEFAULT_EXPORT_OPTIONS,
  type TExportOptions,
  countLineParts,
  excelAlternative,
  exportFileExtension,
  isExcelBlocked,
  isExcelTooLarge,
  isSpssAvailable,
  isTextOnlyAvailable,
  isZipLocked,
  setDisplay,
  setExcludedColumns,
  setFormat,
  setQuestions,
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

/** A square 16px checkbox in the modal's dark style. */
const checkboxClass =
  "size-4 rounded-xs border-slate-900 data-[state=checked]:bg-slate-900 data-[state=checked]:text-white data-[state=indeterminate]:bg-slate-900 data-[state=indeterminate]:text-white [&_svg]:size-3";

const Field = ({
  label,
  htmlFor,
  className,
  children,
}: Readonly<{ label: string; htmlFor?: string; className?: string; children: ReactNode }>) => (
  <div className={cn("flex min-w-0 flex-col gap-3", className)}>
    <Label htmlFor={htmlFor} className="text-slate-900">
      {label}
    </Label>
    {children}
  </div>
);

type TChoice<T extends string> = { value: T; label: string; disabled?: boolean; hint?: string };

/** A Select with the selected option ticked and, for an option that is off, the reason on the right. */
const ChoiceSelect = <T extends string>({
  id,
  value,
  onChange,
  choices,
}: Readonly<{ id: string; value: T; onChange: (value: T) => void; choices: TChoice<T>[] }>) => (
  <Select value={value} onValueChange={(next) => onChange(next as T)}>
    <SelectTrigger id={id} className="h-9 bg-white text-slate-900 shadow-xs">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {choices.map((choice) => (
        <SelectPrimitive.Item
          key={choice.value}
          value={choice.value}
          disabled={choice.disabled}
          className="relative flex cursor-pointer items-center gap-4 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-slate-100 data-disabled:pointer-events-none data-disabled:text-slate-400 data-[state=checked]:bg-slate-100">
          <SelectPrimitive.ItemText>{choice.label}</SelectPrimitive.ItemText>
          {choice.hint && <span className="ml-auto text-xs text-slate-400">{choice.hint}</span>}
          <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
            <CheckIcon className="size-4" />
          </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
      ))}
    </SelectContent>
  </Select>
);

const OptionRow = ({
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
      className={cn(checkboxClass, "mt-0")}
    />
    <div className="flex flex-col">
      <Label
        htmlFor={id}
        className={cn(
          "leading-4 font-normal text-slate-900",
          disabled ? "text-slate-500" : "cursor-pointer"
        )}>
        {label}
      </Label>
      {description && <p className="text-xs leading-4 text-slate-500">{description}</p>}
    </div>
  </div>
);

const ColumnPicker = ({
  groups,
  excluded,
  onChange,
}: Readonly<{
  groups: TExportColumnGroup[];
  excluded: string[];
  onChange: (excluded: string[]) => void;
}>) => {
  const { t } = useTranslation();
  const none = hasNoColumnSelected(groups, excluded);
  return (
    <Field label={t("workspace.surveys.export.columns_title")} className="gap-2">
      {none && (
        <p
          role="alert"
          data-testid="export-no-columns"
          className="flex items-center gap-1 text-sm font-medium text-red-800">
          <CircleAlertIcon className="size-4" />
          {t("workspace.surveys.export.columns_none_selected")}
        </p>
      )}
      <div
        data-testid="export-columns"
        className={cn(
          "flex h-[120px] flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 px-4 py-3",
          none && "border-red-600 ring-1 ring-red-600"
        )}>
        {groups.length === 0 ? (
          <p className="text-sm text-slate-500">{t("workspace.surveys.export.columns_loading")}</p>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-slate-200 pb-[7px]">
              <Checkbox
                id="export-columns-all"
                checked={selectAllState(groups, excluded)}
                onCheckedChange={() => onChange(toggleSelectAll(groups, excluded))}
                className={checkboxClass}
              />
              <Label
                htmlFor="export-columns-all"
                className="cursor-pointer leading-4 font-normal text-slate-900">
                {t("workspace.surveys.export.columns_select_all")}
              </Label>
            </div>
            {groups.map((group) => (
              <div key={group.id} className="flex min-h-4 items-center gap-2">
                <Checkbox
                  id={`export-column-${group.id}`}
                  checked={!excluded.includes(group.id)}
                  onCheckedChange={(checked) => onChange(toggleGroup(excluded, group.id, checked === true))}
                  className={checkboxClass}
                />
                <Label
                  htmlFor={`export-column-${group.id}`}
                  className="cursor-pointer leading-4 font-normal whitespace-nowrap text-slate-900">
                  {group.label}
                </Label>
              </div>
            ))}
          </>
        )}
      </div>
    </Field>
  );
};

const CountBox = ({ children }: Readonly<{ children: ReactNode }>) => (
  <div
    className="flex flex-col gap-1 rounded-lg bg-slate-50 p-3 text-sm"
    data-testid="export-count-line"
    aria-live="polite">
    {children}
  </div>
);

const ExportHeader = () => {
  const { t } = useTranslation();
  return (
    <DialogHeader>
      <DialogTitle className="text-base leading-6 font-semibold text-slate-950">
        {t("workspace.surveys.export.modal_title")}
      </DialogTitle>
      <DialogDescription className="sr-only">{t("workspace.surveys.export.description")}</DialogDescription>
    </DialogHeader>
  );
};

const ExportProgress = ({
  included,
  onClose,
}: Readonly<{ included: number | null; onClose: () => void }>) => {
  const { t } = useTranslation();
  const { progress, cancelExport } = useExportManager();
  return (
    <>
      <ExportHeader />
      <DialogBody className="flex flex-col gap-4" data-testid="export-progress">
        <CountBox>
          {included !== null && (
            <span className="font-medium text-slate-900">
              {t("workspace.surveys.export.count_include", { count: included })}
            </span>
          )}
        </CountBox>
        <div className="flex flex-col gap-2 py-2">
          <p className="font-medium text-slate-900">
            {included === null
              ? t("workspace.surveys.export.export_starting")
              : t("workspace.surveys.export.export_preparing", { count: included })}
          </p>
          <div
            role="progressbar"
            aria-label={t("workspace.surveys.export.export_starting")}
            className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/5 animate-pulse rounded-full bg-slate-900" />
          </div>
          <p className="text-slate-500">
            {t("workspace.surveys.export.export_progress_hint")}
            {progress && progress.bytes > 0 && (
              <> {t("workspace.surveys.export.export_received", { size: formatBytes(progress.bytes) })}</>
            )}
          </p>
        </div>
      </DialogBody>
      <DialogFooter className="items-center gap-4">
        <Button
          variant="secondary"
          size="sm"
          data-testid="export-cancel"
          onClick={() => {
            cancelExport();
            onClose();
          }}>
          {t("workspace.surveys.export.cancel_export")}
        </Button>
        <Button size="sm" disabled>
          <Loader2Icon className="animate-spin" />
          {t("workspace.surveys.export.exporting")}
        </Button>
      </DialogFooter>
    </>
  );
};

const ExportModalBody = ({
  surveyId,
  scope,
  onClose,
  onDownloadAttachments,
}: Readonly<Omit<TExportModalProps, "open" | "onOpenChange"> & { onClose: () => void }>) => {
  const { t } = useTranslation();
  const { startExport, isExporting, progress } = useExportManager();
  // Always the Standard defaults: the modal is mounted afresh on every open and keeps nothing.
  const [options, setOptions] = useState<TExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [advancedOpen, setAdvancedOpen] = useState(true);

  // The counts and the column list do not depend on which columns are on, so toggling one is no new request.
  const countsRequest = toExportRequest(options);
  const counts = useQuery({
    queryKey: ["survey-export-counts", surveyId, countsRequest, scope],
    queryFn: ({ signal }) =>
      fetchExportCounts({ surveyId, request: toExportRequest(options, scope), signal }),
    staleTime: 0,
    retry: false,
  });

  if (isExporting) return <ExportProgress included={progress?.included ?? null} onClose={onClose} />;

  const columnGroups = counts.data?.columnGroups ?? [];
  const request = toExportRequest(options, { ...scope, columnGroups });
  const noColumns = hasNoColumnSelected(columnGroups, options.excludedColumns);

  // Excel is built whole in memory, so a selection past the cap is switched off and CSV recommended.
  const excelTooLarge = isExcelTooLarge(counts.data);
  const excelBlocked = isExcelBlocked(options, counts.data);
  const alternative = excelAlternative(options);
  const excelSize = { cells: counts.data?.excel?.cells ?? 0, max: counts.data?.excel?.maxCells ?? 0 };
  const excelTooLargeMessage =
    alternative === "zip"
      ? t("workspace.surveys.export.excel_too_large_zip", excelSize)
      : t("workspace.surveys.export.excel_too_large_csv", excelSize);

  const displayChoices = (): TChoice<TAnswerDisplay>[] => [
    {
      value: "text",
      label: t("workspace.surveys.export.display_text"),
      disabled: !isTextOnlyAvailable(options),
      hint: isTextOnlyAvailable(options)
        ? undefined
        : t("workspace.surveys.export.display_text_disabled_spss"),
    },
    { value: "codes", label: t("workspace.surveys.export.display_codes") },
    { value: "both", label: t("workspace.surveys.export.display_both") },
  ];

  const countParts = counts.data
    ? countLineParts({
        scope,
        lowQualityLeftOut: counts.data.lowQualityLeftOut,
        total: counts.data.total,
      })
    : [];
  const countPartText = (part: (typeof countParts)[number]): string => {
    switch (part.key) {
      case "filters":
        return t("workspace.surveys.export.count_filters");
      case "selection":
        return t("workspace.surveys.export.count_selection");
      case "low_quality_left_out":
        return t("workspace.surveys.export.count_low_quality_left_out", { count: part.count });
      case "total":
        return t("workspace.surveys.export.count_total", { count: part.count });
    }
  };

  const visibleAdvanced = EXPORT_ADVANCED_OPTIONS.filter((option) =>
    option.appliesTo.includes(options.format)
  );
  const extension = exportFileExtension(options);

  return (
    <>
      <ExportHeader />

      <DialogBody className="flex flex-col gap-4 px-0.5 pb-0.5" data-testid="export-modal">
        <CountBox>
          {counts.data && (
            <>
              <span className="font-medium text-slate-900">
                {t("workspace.surveys.export.count_include", { count: counts.data.included })}
              </span>
              {countParts.length > 0 && (
                <span className="text-slate-500">{countParts.map(countPartText).join(" · ")}</span>
              )}
            </>
          )}
        </CountBox>

        <div className="flex flex-wrap items-end gap-4">
          <Field
            label={t("workspace.surveys.export.format_title")}
            htmlFor="export-format"
            className="w-[300px]">
            <ChoiceSelect<TExportFormat>
              id="export-format"
              value={options.format}
              onChange={(format) => setOptions((current) => setFormat(current, format))}
              choices={[
                { value: "csv", label: t("workspace.surveys.export.format_csv") },
                {
                  value: "xlsx",
                  label: t("workspace.surveys.export.format_excel"),
                  disabled: excelTooLarge,
                },
              ]}
            />
          </Field>
          {isSpssAvailable(options) && (
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="export-spss"
                checked={options.spss}
                onCheckedChange={(checked) => setOptions((current) => setSpss(current, checked === true))}
                className={checkboxClass}
              />
              <Label htmlFor="export-spss" className="cursor-pointer leading-4 font-normal text-slate-900">
                {t("workspace.surveys.export.spss_label")}
              </Label>
            </div>
          )}
        </div>
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

        <div className="flex flex-wrap gap-4">
          <Field
            label={t("workspace.surveys.export.display_questions_title")}
            htmlFor="export-display-questions"
            className="w-[300px]">
            <ChoiceSelect
              id="export-display-questions"
              value={options.questions}
              onChange={(questions) => setOptions((current) => setQuestions(current, questions))}
              choices={displayChoices()}
            />
          </Field>
          <Field
            label={t("workspace.surveys.export.display_answers_title")}
            htmlFor="export-display-answers"
            className="w-[300px]">
            <ChoiceSelect
              id="export-display-answers"
              value={options.display}
              onChange={(display) => setOptions((current) => setDisplay(current, display))}
              choices={displayChoices()}
            />
          </Field>
        </div>

        <ColumnPicker
          groups={columnGroups}
          excluded={options.excludedColumns}
          onChange={(excluded) => setOptions((current) => setExcludedColumns(current, excluded))}
        />

        <div className="flex flex-col gap-4 border-t border-slate-200 pt-4">
          <button
            type="button"
            data-testid="export-advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((current) => !current)}
            className="flex w-fit items-center gap-1 text-sm leading-none font-medium text-slate-900">
            {advancedOpen
              ? t("workspace.surveys.export.advanced_hide")
              : t("workspace.surveys.export.advanced_show")}
            {advancedOpen ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
          </button>
          {advancedOpen && (
            <div className="flex flex-col gap-2">
              {visibleAdvanced.map((option) => (
                <OptionRow
                  key={option.id}
                  id={`export-advanced-${option.id}`}
                  checked={options.advanced.includes(option.id)}
                  onCheckedChange={(checked) =>
                    setOptions((current) => toggleAdvanced(current, option.id, checked))
                  }
                  label={option.label(t)}
                  description={option.description(t)}
                />
              ))}
              {isZipLocked(options) && (
                <OptionRow
                  id="export-zip"
                  checked
                  disabled
                  onCheckedChange={() => undefined}
                  label={t("workspace.surveys.export.zip_label")}
                  description={t("workspace.surveys.export.zip_description")}
                />
              )}
            </div>
          )}
        </div>

        {onDownloadAttachments && (
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
            <p className="text-sm leading-none font-medium text-slate-900">
              {t("workspace.surveys.export.attachments_title")}
            </p>
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
          </div>
        )}
      </DialogBody>

      <DialogFooter className="items-center gap-4">
        <Button variant="secondary" size="sm" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button
          size="sm"
          data-testid="export-submit"
          disabled={excelBlocked || noColumns}
          onClick={() => startExport({ surveyId, request, included: counts.data?.included })}>
          {t("workspace.surveys.export.button_with_type", { extension })}
        </Button>
      </DialogFooter>
    </>
  );
};

/**
 * The Export modal (replaces the Download dropdown). It builds a request from its controls and hands it
 * to the export manager, which carries the export on in the survey layout: the modal shows its progress
 * while it is open, and closing it does not cancel it.
 */
export const ExportModal = ({ open, onOpenChange, ...rest }: Readonly<TExportModalProps>) => {
  const { isExporting } = useExportManager();
  const wasExporting = useRef(false);
  // The progress view gives way to the toast when the file is done (or has failed).
  useEffect(() => {
    if (wasExporting.current && !isExporting) onOpenChange(false);
    wasExporting.current = isExporting;
  }, [isExporting, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width="narrow"
        hideCloseButton
        className="rounded-xl sm:w-[700px]"
        onOpenAutoFocus={(event) => event.preventDefault()}>
        <ExportModalBody {...rest} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
};
