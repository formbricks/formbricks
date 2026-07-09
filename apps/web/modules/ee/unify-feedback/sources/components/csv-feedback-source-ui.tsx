"use client";

import { parse } from "csv-parse/sync";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { FileDropZone } from "@/modules/ui/components/file-drop-zone";
import {
  SAMPLE_CSV_CONTENT,
  SAMPLE_CSV_FILE_NAME,
  TFieldMapping,
  TSourceField,
  createFeedbackCSVDataSchema,
} from "../types";
import { TMappingConfidence, autoMapCsvSourceFields, titleizeFromFileName, validateCsvFile } from "../utils";
import { MappingUI } from "./mapping-ui";

const PREVIEW_ROW_LIMIT = 5;
const CSV_PREVIEW_COLUMN_WIDTH_CLASS = "min-w-[120px] max-w-[200px]";
const CSV_PREVIEW_CELL_TRUNCATE_CLASS = "block max-w-full overflow-hidden text-ellipsis whitespace-nowrap";

const buildCsvPreviewRows = (headers: string[], records: Record<string, string>[]): string[][] =>
  records.slice(0, PREVIEW_ROW_LIMIT).map((row) => headers.map((h) => row[h] ?? ""));

interface CsvFeedbackSourceUIProps {
  sourceFields: TSourceField[];
  mappings: TFieldMapping[];
  onMappingsChange: (mappings: TFieldMapping[]) => void;
  onSourceFieldsChange: (fields: TSourceField[]) => void;
  onFileChange?: (file: File | null) => void;
  onParsedDataChange?: (data: Record<string, string>[]) => void;
  onSuggestFeedbackSourceName?: (name: string) => void;
}

export function CsvFeedbackSourceUI({
  sourceFields,
  mappings,
  onMappingsChange,
  onSourceFieldsChange,
  onFileChange,
  onParsedDataChange,
  onSuggestFeedbackSourceName,
}: Readonly<CsvFeedbackSourceUIProps>) {
  const { t } = useTranslation();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [showMapping, setShowMapping] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [confidenceByTargetId, setConfidenceByTargetId] = useState<Record<string, TMappingConfidence>>({});
  const [previewOpen, setPreviewOpen] = useState(true);
  const [sampleRow, setSampleRow] = useState<Record<string, string> | undefined>(undefined);

  const userEditedSourceNameRef = useRef(false);
  const lastAutoSourceNameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const sourceNameMapping = mappings.find((m) => m.targetFieldId === "source_name");
    const current = sourceNameMapping?.staticValue ?? sourceNameMapping?.sourceFieldId;
    if (lastAutoSourceNameRef.current !== undefined && current !== lastAutoSourceNameRef.current) {
      userEditedSourceNameRef.current = true;
    }
  }, [mappings]);

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
    onSuggestFeedbackSourceName?.(titleizeFromFileName(fileName));
  };

  const processCSVFile = async (file: File) => {
    setCsvError("");
    onFileChange?.(null);

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

      const validRecords = result.data;
      const headers = Object.keys(validRecords[0]);

      const preview: string[][] = [headers, ...buildCsvPreviewRows(headers, validRecords)];
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
      onFileChange?.(file);
      onParsedDataChange?.(validRecords);
      setSampleRow(validRecords[0]);

      applyAutoMapping(fields, validRecords[0], file.name);

      setShowMapping(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("common.failed_to_parse_csv");
      setCsvError(message);
    }
  };

  const handleDownloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = SAMPLE_CSV_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (showMapping && sourceFields.length > 0) {
    const sourceLabel = csvFile?.name ?? t("workspace.unify.csv_sample_label");
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-800" title={sourceLabel}>
              {sourceLabel}
            </span>
            <Badge
              text={t("workspace.unify.csv_rows_count", { count: csvTotalRows })}
              type="gray"
              size="tiny"
              className="shrink-0"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 bg-white"
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
              onFileChange?.(null);
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
              {previewOpen ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
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
              <div className="overflow-x-auto">
                <table className="w-max min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {csvPreview[0]?.map((header, i) => (
                        <th
                          key={`${header}-${i}`}
                          className={`${CSV_PREVIEW_COLUMN_WIDTH_CLASS} px-3 py-2 text-left font-medium text-slate-700`}>
                          <span className={CSV_PREVIEW_CELL_TRUNCATE_CLASS}>{header}</span>
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
                            className={`${CSV_PREVIEW_COLUMN_WIDTH_CLASS} px-3 py-2 text-slate-600`}>
                            <span className={CSV_PREVIEW_CELL_TRUNCATE_CLASS}>
                              {cell || <span className="text-slate-300">—</span>}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <MappingUI
          sourceFields={sourceFields}
          mappings={mappings}
          onMappingsChange={handleUserMappingsChange}
          feedbackSourceType="csv"
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
        <FileDropZone
          id="csv-file-upload"
          accept=".csv"
          onFileSelect={processCSVFile}
          primaryText={t("workspace.unify.click_to_upload")}
          secondaryText={t("workspace.unify.or_drag_and_drop")}
          helpText={t("workspace.unify.csv_files_only")}
        />
        <div className="flex justify-between">
          <Button variant="secondary" size="sm" onClick={handleDownloadSample}>
            {t("workspace.unify.download_sample_csv")}
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
