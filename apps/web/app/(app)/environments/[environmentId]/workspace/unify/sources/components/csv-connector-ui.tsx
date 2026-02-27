"use client";

import { parse } from "csv-parse/sync";
import { ArrowUpFromLineIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { MAX_CSV_VALUES, TFieldMapping, TSourceField, createFeedbackCSVDataSchema } from "../types";
import { MappingUI } from "./mapping-ui";

interface CsvConnectorUIProps {
  sourceFields: TSourceField[];
  mappings: TFieldMapping[];
  onMappingsChange: (mappings: TFieldMapping[]) => void;
  onSourceFieldsChange: (fields: TSourceField[]) => void;
  onLoadSampleCSV: () => void;
  onParsedDataChange?: (data: Record<string, string>[]) => void;
}

export function CsvConnectorUI({
  sourceFields,
  mappings,
  onMappingsChange,
  onSourceFieldsChange,
  onLoadSampleCSV,
  onParsedDataChange,
}: CsvConnectorUIProps) {
  const { t } = useTranslation();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [showMapping, setShowMapping] = useState(false);
  const [csvError, setCsvError] = useState("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (file) {
      processCSVFile(file);
    }
  };

  const processCSVFile = (file: File) => {
    setCsvError("");

    if (!file.name.endsWith(".csv")) {
      setCsvError(t("environments.unify.csv_files_only"));
      return;
    }

    if (file.type && file.type !== "text/csv" && !file.type.includes("csv")) {
      setCsvError(t("environments.unify.csv_files_only"));
      return;
    }

    if (file.size > MAX_CSV_VALUES.FILE_SIZE) {
      setCsvError(t("environments.unify.csv_file_too_large"));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;

      try {
        const records = parse(csv, { columns: true, skip_empty_lines: true });

        const result = createFeedbackCSVDataSchema(t).safeParse(records);
        if (!result.success) {
          setCsvError(result.error.errors[0].message);
          return;
        }

        const validRecords = result.data;
        const headers = Object.keys(validRecords[0]);

        const preview: string[][] = [
          headers,
          ...validRecords.slice(0, 5).map((row) => headers.map((h) => row[h] ?? "")),
        ];
        setCsvFile(file);
        setCsvPreview(preview);

        const fields: TSourceField[] = headers.map((header) => ({
          id: header,
          name: header,
          type: "string",
          sampleValue: validRecords[0][header] ?? "",
        }));
        onSourceFieldsChange(fields);
        onParsedDataChange?.(validRecords);
        setShowMapping(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to parse CSV";
        setCsvError(message);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      processCSVFile(file);
    }
  };

  const handleLoadSample = () => {
    onLoadSampleCSV();
    setShowMapping(true);
  };

  if (showMapping && sourceFields.length > 0) {
    return (
      <div className="space-y-4">
        {csvFile && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">{csvFile.name}</span>
              <Badge text={`${csvPreview.length - 1} rows`} type="gray" size="tiny" />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCsvFile(null);
                setCsvPreview([]);
                setCsvError("");
                setShowMapping(false);
                onSourceFieldsChange([]);
                onParsedDataChange?.([]);
              }}>
              {t("environments.unify.change_file")}
            </Button>
          </div>
        )}

        {csvPreview.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {csvPreview[0]?.map((header, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-slate-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.slice(1, 4).map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-slate-100">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 text-slate-600">
                          {cell || <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvPreview.length > 4 && (
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-500">
                {t("environments.unify.showing_rows", { count: csvPreview.length - 1 })}
              </div>
            )}
          </div>
        )}

        <MappingUI
          sourceFields={sourceFields}
          mappings={mappings}
          onMappingsChange={onMappingsChange}
          connectorType="csv"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {csvError && (
        <Alert variant="error" size="small">
          {csvError}
        </Alert>
      )}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-700">{t("environments.unify.upload_csv_file")}</h4>
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6">
          <label
            htmlFor="csv-file-upload"
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
              id="csv-file-upload"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
        <div className="flex justify-between">
          <Button variant="secondary" size="sm" onClick={handleLoadSample}>
            {t("environments.unify.load_sample_csv")}
          </Button>
        </div>
      </div>
    </div>
  );
}
