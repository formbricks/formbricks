"use client";

import { parse } from "csv-parse/sync";
import { ArrowUpFromLineIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { validateCsvFile } from "@/app/(app)/environments/[environmentId]/workspace/unify/sources/utils";
import { importCsvDataAction } from "@/lib/connector/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { createFeedbackCSVDataSchema } from "../types";

interface CsvImportSectionProps {
  connectorId: string;
  environmentId: string;
  onImportComplete?: () => void;
}

export function CsvImportSection({ connectorId, environmentId, onImportComplete }: CsvImportSectionProps) {
  const { t } = useTranslation();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [rowCount, setRowCount] = useState(0);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [csvError, setCsvError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const processCSVFile = (file: File) => {
    setCsvError("");

    const validateCSVFileResult = validateCsvFile(file, t);

    if (!validateCSVFileResult.valid) {
      setCsvError(validateCSVFileResult.error);
      return;
    }

    file
      .text()
      .then((csv) => {
        const records = parse(csv, { columns: true, skip_empty_lines: true });
        const result = createFeedbackCSVDataSchema(t).safeParse(records);

        if (!result.success) {
          setCsvError(result.error.errors[0].message);
          return;
        }

        setCsvFile(file);
        setParsedData(result.data);
        setRowCount(result.data.length);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : t("common.failed_to_parse_csv");
        setCsvError(message);
      });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (file) processCSVFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) processCSVFile(file);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setIsImporting(true);
    const result = await importCsvDataAction({ connectorId, environmentId, csvData: parsedData });
    setIsImporting(false);

    if (result?.data) {
      toast.success(
        t("environments.unify.csv_import_complete", {
          successes: result.data.successes,
          failures: result.data.failures,
          skipped: result.data.skipped,
        })
      );
      setCsvFile(null);
      setParsedData([]);
      setRowCount(0);
      onImportComplete?.();
    } else {
      toast.error(getFormattedErrorMessage(result));
    }
  };

  const handleClear = () => {
    setCsvFile(null);
    setParsedData([]);
    setRowCount(0);
    setCsvError("");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="text-xs text-amber-800">{t("environments.unify.csv_import_duplicate_warning")}</p>
      </div>

      {csvError && (
        <Alert variant="error" size="small">
          {csvError}
        </Alert>
      )}

      {csvFile ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">{csvFile.name}</span>
              <Badge text={`${rowCount} rows`} type="gray" size="tiny" />
            </div>
            <Button variant="secondary" size="sm" onClick={handleClear} disabled={isImporting}>
              {t("environments.unify.change_file")}
            </Button>
          </div>

          <Button onClick={handleImport} disabled={isImporting} className="w-full">
            {isImporting ? (
              <>
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                {t("environments.unify.importing_data")}
              </>
            ) : (
              t("environments.unify.import_rows", { count: rowCount })
            )}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6">
          <label
            htmlFor="csv-import-upload"
            className="flex cursor-pointer flex-col items-center justify-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}>
            <ArrowUpFromLineIcon className="h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold">{t("environments.unify.click_to_upload")}</span>{" "}
              {t("environments.unify.or_drag_and_drop")}
            </p>
            <p className="mt-1 text-xs text-slate-400">{t("environments.unify.csv_files_only")}</p>
            <input
              type="file"
              id="csv-import-upload"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}
    </div>
  );
}
