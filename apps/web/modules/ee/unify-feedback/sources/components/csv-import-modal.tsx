"use client";

import { parse } from "csv-parse/sync";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TFeedbackSourceFieldMapping } from "@formbricks/types/feedback-source";
import {
  formatCsvMissingMappedSourceColumns,
  getMissingCsvMappedSourceColumns,
  getMissingRequiredCsvSourceColumns,
} from "@/lib/feedback-source/utils";
import { Alert } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { FileDropZone } from "@/modules/ui/components/file-drop-zone";
import { importCsvFile } from "../csv-import-client";
import { createFeedbackCSVDataSchema, getTranslatedFeedbackSourceError } from "../types";
import { validateCsvFile } from "../utils";

interface CsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedbackSourceId: string;
  workspaceId: string;
  fieldMappings: TFeedbackSourceFieldMapping[];
  onOpenEditFeedbackSource?: () => void;
}

export function CsvImportModal({
  open,
  onOpenChange,
  feedbackSourceId,
  workspaceId,
  fieldMappings,
  onOpenEditFeedbackSource,
}: CsvImportModalProps) {
  const { t } = useTranslation();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [csvError, setCsvError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const processCSVFile = async (file: File) => {
    setCsvError("");

    const validateCSVFileResult = validateCsvFile(file, t);

    if (!validateCSVFileResult.valid) {
      setCsvError(validateCSVFileResult.error);
      return;
    }

    try {
      const csv = await file.text();
      const records = parse(csv, { columns: true, relax_column_count: true, skip_empty_lines: true });
      const result = createFeedbackCSVDataSchema(t).safeParse(records);

      if (!result.success) {
        setCsvError(result.error.issues[0].message);
        return;
      }

      const missingMappedColumns = getMissingCsvMappedSourceColumns(
        fieldMappings,
        Object.keys(result.data[0] ?? {})
      );
      if (missingMappedColumns.length > 0) {
        const missingRequiredSourceColumns = getMissingRequiredCsvSourceColumns(
          fieldMappings,
          Object.keys(result.data[0] ?? {})
        );
        const missingSourceColumns =
          missingRequiredSourceColumns.length > 0
            ? missingRequiredSourceColumns.join(", ")
            : [...new Set(missingMappedColumns.map(({ sourceFieldId }) => sourceFieldId))].join(", ");

        setCsvError(
          t("workspace.unify.csv_saved_mapping_missing_columns", {
            columns: missingSourceColumns,
            mappings: formatCsvMissingMappedSourceColumns(missingMappedColumns),
          })
        );
        return;
      }

      setCsvFile(file);
      setParsedData(result.data);
      setRowCount(result.data.length);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("common.failed_to_parse_csv");
      setCsvError(message);
    }
  };

  const handleImport = async () => {
    if (!csvFile || parsedData.length === 0) return;

    setIsImporting(true);
    const result = await importCsvFile({ feedbackSourceId, workspaceId, file: csvFile });
    setIsImporting(false);

    if (result?.data) {
      toast.success(
        t("workspace.unify.csv_import_complete", {
          successes: result.data.successes,
          failures: result.data.failures,
          skipped: result.data.skipped,
        })
      );
      setCsvFile(null);
      setParsedData([]);
      setRowCount(0);
      onOpenChange(false);
    } else {
      toast.error(
        getTranslatedFeedbackSourceError(result.error.error, t, {
          row: result.error.row,
          max: result.error.max,
        })
      );
    }
  };

  const handleClear = () => {
    setCsvFile(null);
    setParsedData([]);
    setRowCount(0);
    setCsvError("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workspace.unify.import_csv_data")}</DialogTitle>
          <DialogDescription>{t("workspace.unify.upload_csv_data_description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {t("workspace.unify.csv_import_duplicate_warning")}
          </p>

          {csvError && (
            <Alert variant="error" size="small">
              {csvError}
            </Alert>
          )}

          {csvFile ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-medium text-slate-800" title={csvFile.name}>
                  {csvFile.name}
                </span>
                <Badge text={`${rowCount} rows`} type="gray" size="tiny" className="shrink-0" />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClear}
                disabled={isImporting}
                className="shrink-0 bg-white">
                {t("workspace.unify.change_file")}
              </Button>
            </div>
          ) : (
            <FileDropZone
              id="csv-import-upload"
              accept=".csv"
              onFileSelect={processCSVFile}
              primaryText={t("workspace.unify.click_to_upload")}
              secondaryText={t("workspace.unify.or_drag_and_drop")}
              helpText={t("workspace.unify.csv_files_only")}
            />
          )}
        </div>

        <DialogFooter>
          {onOpenEditFeedbackSource && (
            <Button
              variant="secondary"
              onClick={() => {
                onOpenChange(false);
                onOpenEditFeedbackSource();
              }}>
              {t("workspace.unify.edit_csv_mapping")}
            </Button>
          )}
          <Button onClick={handleImport} disabled={parsedData.length === 0 || isImporting}>
            {isImporting ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                {t("workspace.unify.importing_data")}
              </>
            ) : (
              t("workspace.unify.import_rows", { count: rowCount })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
