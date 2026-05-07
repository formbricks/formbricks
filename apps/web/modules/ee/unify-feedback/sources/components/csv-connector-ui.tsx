"use client";

import { parse } from "csv-parse/sync";
import { ArrowUpFromLineIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { SAMPLE_CSV_COLUMNS, TFieldMapping, TSourceField, createFeedbackCSVDataSchema } from "../types";
import {
  TMappingConfidence,
  autoMapCsvSourceFields,
  parseCSVColumnsToFields,
  titleizeFromFileName,
  validateCsvFile,
} from "../utils";
import { MappingUI } from "./mapping-ui";

interface CsvConnectorUIProps {
  sourceFields: TSourceField[];
  mappings: TFieldMapping[];
  onMappingsChange: (mappings: TFieldMapping[]) => void;
  onSourceFieldsChange: (fields: TSourceField[]) => void;
  onParsedDataChange?: (data: Record<string, string>[]) => void;
  onSuggestConnectorName?: (name: string) => void;
}

export function CsvConnectorUI({
  sourceFields,
  mappings,
  onMappingsChange,
  onSourceFieldsChange,
  onParsedDataChange,
  onSuggestConnectorName,
}: Readonly<CsvConnectorUIProps>) {
  const { t } = useTranslation();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [showMapping, setShowMapping] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [confidenceByTargetId, setConfidenceByTargetId] = useState<Record<string, TMappingConfidence>>({});
  const [previewOpen, setPreviewOpen] = useState(true);
  const [sampleRow, setSampleRow] = useState<Record<string, string> | undefined>(undefined);

  // Track whether the user has manually edited the source_name mapping after auto-population.
  // On re-upload, only overwrite source_name if the user hasn't touched it.
  const userEditedSourceNameRef = useRef(false);
  const lastAutoSourceNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const sourceNameMapping = mappings.find((m) => m.targetFieldId === "source_name");
    const current = sourceNameMapping?.staticValue ?? sourceNameMapping?.sourceFieldId;
    if (
      lastAutoSourceNameRef.current !== undefined &&
      current !== undefined &&
      current !== lastAutoSourceNameRef.current
    ) {
      userEditedSourceNameRef.current = true;
    }
  }, [mappings]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target?.files?.[0];
    if (file) {
      processCSVFile(file);
    }
  };

  // User-driven mapping changes clear the auto-map badge for any target whose mapping changed,
  // so the badge sticks until auto-map runs again. Even if the user picks the same value back,
  // the field is now "user-confirmed" rather than "auto-mapped". Auto-map itself bypasses this
  // wrapper and uses `onMappingsChange` directly.
  const handleUserMappingsChange = (newMappings: TFieldMapping[]) => {
    const oldByTarget = new Map(mappings.map((m) => [m.targetFieldId, m]));
    const newByTarget = new Map(newMappings.map((m) => [m.targetFieldId, m]));
    const changedIds = new Set<string>();
    for (const [id, m] of newByTarget) {
      const prev = oldByTarget.get(id);
      if (!prev || prev.sourceFieldId !== m.sourceFieldId || prev.staticValue !== m.staticValue) {
        changedIds.add(id);
      }
    }
    for (const id of oldByTarget.keys()) {
      if (!newByTarget.has(id)) changedIds.add(id);
    }

    if (changedIds.size > 0) {
      setConfidenceByTargetId((prev) => {
        const next = { ...prev };
        for (const id of changedIds) delete next[id];
        return next;
      });
    }

    onMappingsChange(newMappings);
  };

  const applyAutoMapping = (fields: TSourceField[], sampleRow: Record<string, string>, fileName: string) => {
    const { mappings: autoMappings, confidence } = autoMapCsvSourceFields({
      sourceFields: fields,
      sampleRow,
      fileName,
    });

    const autoSourceNameStatic = autoMappings.find((m) => m.targetFieldId === "source_name")?.staticValue;

    // Preserve a user-edited source_name mapping across re-uploads.
    if (userEditedSourceNameRef.current) {
      const existingSourceName = mappings.find((m) => m.targetFieldId === "source_name");
      if (existingSourceName) {
        const filtered = autoMappings.filter((m) => m.targetFieldId !== "source_name");
        onMappingsChange([...filtered, existingSourceName]);
        const nextConfidence = { ...confidence };
        delete nextConfidence.source_name;
        setConfidenceByTargetId(nextConfidence);
      } else {
        onMappingsChange(autoMappings);
        setConfidenceByTargetId(confidence);
      }
    } else {
      onMappingsChange(autoMappings);
      setConfidenceByTargetId(confidence);
    }

    lastAutoSourceNameRef.current = autoSourceNameStatic;
    onSuggestConnectorName?.(titleizeFromFileName(fileName));
  };

  const processCSVFile = (file: File) => {
    setCsvError("");

    const validateCSVFileResult = validateCsvFile(file, t);

    if (!validateCSVFileResult.valid) {
      setCsvError(validateCSVFileResult.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;

      try {
        const records = parse(csv, { columns: true, skip_empty_lines: true });

        const result = createFeedbackCSVDataSchema(t).safeParse(records);
        if (!result.success) {
          setCsvError(result.error.issues[0].message);
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
        setCsvTotalRows(validRecords.length);

        const fields: TSourceField[] = headers.map((header) => ({
          id: header,
          name: header,
          type: "string",
          sampleValue: validRecords[0][header] ?? "",
        }));
        onSourceFieldsChange(fields);
        onParsedDataChange?.(validRecords);
        setSampleRow(validRecords[0]);

        applyAutoMapping(fields, validRecords[0], file.name);

        setShowMapping(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : t("common.failed_to_parse_csv");
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
    const fields = parseCSVColumnsToFields(SAMPLE_CSV_COLUMNS);
    const synthSampleRow = Object.fromEntries(fields.map((f) => [f.id, f.sampleValue ?? ""])) as Record<
      string,
      string
    >;
    onSourceFieldsChange(fields);
    onParsedDataChange?.([]);
    setSampleRow(synthSampleRow);
    // Build a synthetic 1-row preview so the data preview block has something to render.
    setCsvPreview([fields.map((f) => f.id), fields.map((f) => f.sampleValue ?? "")]);
    setCsvTotalRows(1);
    applyAutoMapping(fields, synthSampleRow, "sample-feedback.csv");
    setShowMapping(true);
  };

  if (showMapping && sourceFields.length > 0) {
    const sourceLabel = csvFile?.name ?? t("workspace.unify.csv_sample_label");
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800">{sourceLabel}</span>
            <Badge text={`${csvTotalRows} rows`} type="gray" size="tiny" />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCsvFile(null);
              setCsvPreview([]);
              setCsvTotalRows(0);
              setCsvError("");
              setShowMapping(false);
              setConfidenceByTargetId({});
              setSampleRow(undefined);
              userEditedSourceNameRef.current = false;
              lastAutoSourceNameRef.current = undefined;
              onSourceFieldsChange([]);
              onParsedDataChange?.([]);
            }}>
            {t("workspace.unify.change_file")}
          </Button>
        </div>

        {csvPreview.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              className="flex w-full items-center gap-1 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100">
              {previewOpen ? (
                <ChevronDownIcon className="h-3 w-3" />
              ) : (
                <ChevronRightIcon className="h-3 w-3" />
              )}
              {t("workspace.unify.csv_data_preview")}
              {(() => {
                const visible = Math.min(3, Math.max(csvPreview.length - 1, 0));
                if (visible >= csvTotalRows) return null;
                return (
                  <span className="text-slate-500">
                    ({t("workspace.unify.showing_rows", { visible, total: csvTotalRows })})
                  </span>
                );
              })()}
            </button>
            {previewOpen && (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {csvPreview[0]?.map((header, i) => (
                          <th
                            key={`${header}-${i}`}
                            className="px-3 py-2 text-left font-medium text-slate-700">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.slice(1, 4).map((row, rowIndex) => (
                        <tr key={`${rowIndex}-${row.join("|")}`} className="border-t border-slate-100">
                          {row.map((cell, cellIndex) => (
                            <td
                              key={`${csvPreview[0]?.[cellIndex] ?? cellIndex}-${cellIndex}`}
                              className="px-3 py-2 text-slate-600">
                              {cell || <span className="text-slate-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <MappingUI
          sourceFields={sourceFields}
          mappings={mappings}
          onMappingsChange={handleUserMappingsChange}
          connectorType="csv"
          confidenceByTargetId={confidenceByTargetId}
          sampleRow={sampleRow}
        />

        <UnmappedColumnsFooter sourceFields={sourceFields} mappings={mappings} />
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
        <h4 className="text-sm font-medium text-slate-700">{t("workspace.unify.upload_csv_file")}</h4>
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6">
          <label
            htmlFor="csv-file-upload"
            className="flex cursor-pointer flex-col items-center justify-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}>
            <ArrowUpFromLineIcon className="h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold">{t("workspace.unify.click_to_upload")}</span>{" "}
              {t("workspace.unify.or_drag_and_drop")}
            </p>
            <p className="mt-1 text-xs text-slate-400">{t("workspace.unify.csv_files_only")}</p>
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
            {t("workspace.unify.load_sample_csv")}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface UnmappedColumnsFooterProps {
  sourceFields: TSourceField[];
  mappings: TFieldMapping[];
}

const UnmappedColumnsFooter = ({ sourceFields, mappings }: Readonly<UnmappedColumnsFooterProps>) => {
  const { t } = useTranslation();
  const claimed = new Set(mappings.map((m) => m.sourceFieldId).filter((id): id is string => Boolean(id)));
  const unmapped = sourceFields.filter((f) => !claimed.has(f.id));
  if (unmapped.length === 0) return null;

  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <p className="font-medium">
        {t("workspace.unify.csv_unmapped_columns", {
          count: unmapped.length,
          columns: unmapped.map((c) => c.name).join(", "),
        })}
      </p>
      <p className="mt-0.5 text-slate-500">{t("workspace.unify.csv_unmapped_columns_explainer")}</p>
    </div>
  );
};
