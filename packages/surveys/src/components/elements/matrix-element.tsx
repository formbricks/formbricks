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
  const isCurrent = element.id === currentElementId;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();

  const rowShuffleIdx = useMemo(() => {
    if (element.shuffleOption !== "none") {
      return getShuffledRowIndices(element.rows.length, element.shuffleOption);
    }
    return element.rows.map((_, id) => id);

    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to recompute when the shuffleOption changes
  }, [element.shuffleOption, element.rows.length]);

  const elementRows = useMemo(() => {
    if (!element.rows.length) {
      return [];
    }
    if (element.shuffleOption === "none") {
      return element.rows;
    }
    return rowShuffleIdx.map((shuffledIdx) => {
      return element.rows[shuffledIdx];
    });
  }, [element.shuffleOption, element.rows, rowShuffleIdx]);

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
        }
      }
    });

    return result;
  };

  // Convert value from row id -> column id mapping to row label -> column label mapping
  const convertValueFromIds = (valueObj: Record<string, string>): Record<string, string> => {
    const result: Record<string, string> = {};

    Object.entries(valueObj).forEach(([rowId, columnId]) => {
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

  const validateRequired = (): boolean => {
    if (element.required) {
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
      />
    </form>
  );
}
