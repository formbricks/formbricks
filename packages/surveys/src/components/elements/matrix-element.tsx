import { useMemo, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { Matrix, type MatrixOption } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMatrixElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getShuffledRowIndices } from "@/lib/utils";

interface MatrixElementProps {
  element: TSurveyMatrixElement;
  value: Record<string, string>;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentElementId: string;
}

export function MatrixElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
}: Readonly<MatrixElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [otherValue, setOtherValue] = useState("");
  const isCurrent = element.id === currentElementId;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();

  // Separate "other" row from regular rows
  const otherRow = useMemo(() => element.rows.find((r) => r.id === "other"), [element.rows]);
  const regularRows = useMemo(() => element.rows.filter((r) => r.id !== "other"), [element.rows]);

  const rowShuffleIdx = useMemo(() => {
    if (element.shuffleOption !== "none") {
      return getShuffledRowIndices(regularRows.length, element.shuffleOption);
    }
    return regularRows.map((_, id) => id);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to recompute when the shuffleOption changes
  }, [element.shuffleOption, regularRows.length]);

  const elementRows = useMemo(() => {
    if (!regularRows.length) {
      return [];
    }
    if (element.shuffleOption === "none") {
      return regularRows;
    }
    return rowShuffleIdx.map((shuffledIdx) => {
      return regularRows[shuffledIdx];
    });
  }, [element.shuffleOption, regularRows, rowShuffleIdx]);

  // Convert rows to MatrixOption format
  const rows: MatrixOption[] = useMemo(() => {
    return elementRows.map((row, index) => ({
      id: `row-${index}`,
      label: getLocalizedValue(row.label, languageCode),
    }));
  }, [elementRows, languageCode]);

  // Convert columns to MatrixOption format
  const columns: MatrixOption[] = useMemo(() => {
    return element.columns.map((column, index) => ({
      id: `col-${index}`,
      label: getLocalizedValue(column.label, languageCode),
    }));
  }, [element.columns, languageCode]);

  // Set of known regular row labels for detecting "other" responses
  const knownRowLabels = useMemo(() => {
    return new Set(rows.map((r) => r.label));
  }, [rows]);

  // Convert value from row label -> column label mapping to row id -> column id mapping
  const convertValueToIds = (valueObj: Record<string, string>): Record<string, string> => {
    const result: Record<string, string> = {};

    Object.entries(valueObj).forEach(([rowLabel, columnLabel]) => {
      if (columnLabel) {
        // Find the row ID that corresponds to this row label
        const rowId = rows.find((row) => row.label === rowLabel)?.id;
        // Find the column ID that corresponds to this column label
        const columnId = columns.find((col) => col.label === columnLabel)?.id;

        if (rowId && columnId) {
          result[rowId] = columnId;
        } else if (!knownRowLabels.has(rowLabel) && otherRow) {
          // This is the "other" row response — recover the typed text and column
          const otherColumnId = columns.find((col) => col.label === columnLabel)?.id;
          if (otherColumnId) {
            result["other"] = otherColumnId;
            // Recover the typed text (only set once on initial hydration)
            if (!otherValue && rowLabel) {
              setOtherValue(rowLabel);
            }
          }
        }
      }
    });

    return result;
  };

  // Convert value from row id -> column id mapping to row label -> column label mapping
  const convertValueFromIds = (valueObj: Record<string, string>): Record<string, string> => {
    const result: Record<string, string> = {};

    Object.entries(valueObj).forEach(([rowId, columnId]) => {
      if (rowId === "other") {
        // For "other" row, use the typed text as the response key
        const columnLabel = columns.find((col) => col.id === columnId)?.label;
        if (columnLabel && otherValue) {
          result[otherValue] = columnLabel;
        }
        return;
      }
      // Find the row label that corresponds to this row ID
      const rowLabel = rows.find((row) => row.id === rowId)?.label;
      // Find the column label that corresponds to this column ID
      const columnLabel = columns.find((col) => col.id === columnId)?.label;

      if (rowLabel && columnLabel) {
        result[rowLabel] = columnLabel;
      }
    });

    return result;
  };

  const handleChange = (newValue: Record<string, string>) => {
    setErrorMessage(undefined);
    const labelValue = convertValueFromIds(newValue);

    // Check if all values are empty and if so, make it an empty object
    if (Object.values(labelValue).every((val) => val === "")) {
      onChange({ [element.id]: {} });
    } else {
      onChange({ [element.id]: labelValue });
    }
  };

  const handleOtherValueChange = (newText: string) => {
    setOtherValue(newText);
    // Re-emit the current value with updated other text
    const currentIds = convertValueToIds(value);
    if (currentIds["other"]) {
      const columnLabel = columns.find((col) => col.id === currentIds["other"])?.label;
      if (columnLabel) {
        // Build label value from scratch with the new text
        const result: Record<string, string> = {};
        Object.entries(currentIds).forEach(([rowId, colId]) => {
          if (rowId === "other") {
            if (newText) {
              const colLabel = columns.find((c) => c.id === colId)?.label;
              if (colLabel) result[newText] = colLabel;
            }
          } else {
            const rowLabel = rows.find((r) => r.id === rowId)?.label;
            const colLabel = columns.find((c) => c.id === colId)?.label;
            if (rowLabel && colLabel) result[rowLabel] = colLabel;
          }
        });
        onChange({ [element.id]: result });
      }
    }
  };

  const validateRequired = (): boolean => {
    if (element.required) {
      // Only regular rows must have a column selected; "other" row is always optional
      const hasUnansweredRows = rows.some((row) => !value[row.label]);
      if (hasUnansweredRows) {
        setErrorMessage(t("errors.please_select_an_option"));
        return false;
      }
    }
    return true;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    setErrorMessage(undefined);
    if (!validateRequired()) return;
    const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  const otherRowLabel = otherRow ? getLocalizedValue(otherRow.label, languageCode) : undefined;
  const otherRowPlaceholder = element.otherOptionPlaceholder
    ? getLocalizedValue(element.otherOptionPlaceholder, languageCode)
    : undefined;

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <Matrix
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={getLocalizedValue(element.subheader, languageCode)}
        rows={rows}
        columns={columns}
        value={convertValueToIds(value)}
        onChange={handleChange}
        required={element.required}
        errorMessage={errorMessage}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
        otherRowId={otherRow ? "other" : undefined}
        otherRowLabel={otherRowLabel}
        otherRowPlaceholder={otherRowPlaceholder}
        otherRowValue={otherValue}
        onOtherRowValueChange={handleOtherValueChange}
      />
    </form>
  );
}
