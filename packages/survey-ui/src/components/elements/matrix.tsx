import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { AlertCircle } from "lucide-react";
import * as React from "react";
import { useTextDirection } from "../../hooks/use-text-direction";
import { cn } from "../../lib/utils";
import { ElementHeader } from "../general/element-header";
import { Label } from "../general/label";
import { RadioGroupItem } from "../general/radio-group";

/**
 * Option for matrix question rows and columns
 */
export interface MatrixOption {
  /** Unique identifier for the option */
  id: string;
  /** Display label for the option */
  label: string;
}

interface MatrixProps {
  /** Unique identifier for the element container */
  elementId: string;
  /** The main question or prompt text displayed as the headline */
  headline: string;
  /** Optional descriptive text displayed below the headline */
  description?: string;
  /** Unique identifier for the matrix group */
  inputId: string;
  /** Array of row options (left side) */
  rows: MatrixOption[];
  /** Array of column options (top header) */
  columns: MatrixOption[];
  /** Currently selected values: Record mapping row ID to column ID */
  value?: Record<string, string>;
  /** Callback function called when selection changes */
  onChange: (value: Record<string, string>) => void;
  /** Whether the field is required (shows asterisk indicator) */
  required?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Text direction: 'ltr' (left-to-right), 'rtl' (right-to-left), or 'auto' (auto-detect from content) */
  dir?: "ltr" | "rtl" | "auto";
  /** Whether the options are disabled */
  disabled?: boolean;
}

function Matrix({
  elementId,
  headline,
  description,
  inputId,
  rows,
  columns,
  value = {},
  onChange,
  required = false,
  errorMessage,
  dir = "auto",
  disabled = false,
}: MatrixProps): React.JSX.Element {
  // Ensure value is always an object
  const selectedValues = value && typeof value === "object" ? value : {};

  // Check which rows have errors (no selection when required)
  const hasError = Boolean(errorMessage);
  const rowsWithErrors = hasError && required ? rows.filter((row) => !selectedValues[row.id]) : [];

  const handleRowChange = (rowId: string, columnId: string) => {
    const newValue = { ...selectedValues };
    // Toggle: if same column is selected, deselect it
    if (newValue[rowId] === columnId) {
      delete newValue[rowId];
    } else {
      newValue[rowId] = columnId;
    }
    onChange(newValue);
  };

  // Detect text direction from content
  const detectedDir = useTextDirection({
    dir,
    textContent: [
      headline,
      description ?? "",
      ...rows.map((row) => row.label),
      ...columns.map((col) => col.label),
    ],
  });

  return (
    <div className="w-full space-y-4" id={elementId} dir={detectedDir}>
      {/* Headline */}
      <ElementHeader headline={headline} description={description} required={required} htmlFor={inputId} />

      {/* Matrix Table */}
      <div className="relative">
        {errorMessage && (
          <div className="text-destructive flex items-center gap-1 text-sm" dir={detectedDir}>
            <AlertCircle className="size-4" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Error indicator bar on the left */}
        {hasError && (
          <div
            className="bg-destructive absolute bottom-0 left-[-12px] top-0 mt-0"
            style={{ width: "4px" }}
          />
        )}

        {/* Table container with overflow for mobile */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Column headers */}
            <thead>
              <tr>
                <th className="p-2 text-left" />
                {columns.map((column) => (
                  <th key={column.id} className="p-2 text-center font-normal">
                    <Label>{column.label}</Label>
                  </th>
                ))}
              </tr>
            </thead>
            {/* Rows */}
            <tbody>
              {rows.map((row, index) => {
                const rowGroupId = `${inputId}-row-${row.id}`;
                const selectedColumnId = selectedValues[row.id];
                const rowHasError = rowsWithErrors.includes(row);
                const baseBgColor = index % 2 === 0 ? "var(--fb-input-bg-color)" : "transparent";

                return (
                  <tr
                    key={row.id}
                    className={cn("relative")}
                    style={{
                      backgroundColor: rowHasError ? "var(--destructive)" : baseBgColor, // destructive background muted (#fef2f2)
                    }}>
                    {/* Row label */}
                    <td className="px-1 py-2 align-middle">
                      <div className="flex flex-col gap-0 leading-none">
                        <Label className="text-xs font-medium">{row.label}</Label>
                        {rowHasError && (
                          <span className="text-xs font-normal" style={{ color: "hsl(0 65% 51%)" }}>
                            Select one option
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Column options for this row - use RadioGroupPrimitive directly to avoid wrapper divs */}
                    <RadioGroupPrimitive.Root
                      value={selectedColumnId}
                      onValueChange={(newColumnId) => handleRowChange(row.id, newColumnId)}
                      disabled={disabled}
                      dir={detectedDir}
                      className="contents"
                      aria-invalid={Boolean(errorMessage)}>
                      {columns.map((column) => {
                        const cellId = `${rowGroupId}-${column.id}`;

                        return (
                          <td key={column.id} className="p-2 text-center align-middle">
                            <label htmlFor={cellId} className="flex cursor-pointer justify-center">
                              <RadioGroupItem value={column.id} id={cellId} disabled={disabled} />
                            </label>
                          </td>
                        );
                      })}
                    </RadioGroupPrimitive.Root>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export { Matrix };
export type { MatrixProps };
