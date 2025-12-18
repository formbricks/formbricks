import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as React from "react";
import { ElementError } from "@/components/general/element-error";
import { ElementHeader } from "@/components/general/element-header";
import { Label } from "@/components/general/label";
import { RadioGroupItem } from "@/components/general/radio-group";
import { cn } from "@/lib/utils";

/**
 * Option for matrix element rows and columns
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
  /** The main element or prompt text displayed as the headline */
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
  /** Image URL to display above the headline */
  imageUrl?: string;
  /** Video URL to display above the headline */
  videoUrl?: string;
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
  imageUrl,
  videoUrl,
}: Readonly<MatrixProps>): React.JSX.Element {
  // Ensure value is always an object (value already has default of {})
  const selectedValues = value;

  // Check which rows have errors (no selection when required)
  const hasError = Boolean(errorMessage);
  const rowsWithErrors = hasError && required ? rows.filter((row) => !selectedValues[row.id]) : [];

  const handleRowChange = (rowId: string, columnId: string): void => {
    // Toggle: if same column is selected, deselect it
    if (selectedValues[rowId] === columnId) {
      // Create new object without the rowId property
      const { [rowId]: _, ...rest } = selectedValues;
      onChange(rest);
    } else {
      onChange({ ...selectedValues, [rowId]: columnId });
    }
  };

  return (
    <div className="w-full space-y-4" id={elementId} dir={dir}>
      {/* Headline */}
      <ElementHeader
        headline={headline}
        description={description}
        required={required}
        htmlFor={inputId}
        imageUrl={imageUrl}
        videoUrl={videoUrl}
      />

      {/* Matrix Table */}
      <div className="relative">
        <ElementError errorMessage={errorMessage} dir={dir} />

        {/* Table container with overflow for mobile */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Column headers */}
            <thead>
              <tr>
                <th className="p-2 text-left" />
                {columns.map((column) => (
                  <th key={column.id} className="p-2 text-center font-normal">
                    <Label className="justify-center">{column.label}</Label>
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
                const baseBgColor = index % 2 === 0 ? "bg-input-bg" : "bg-transparent";

                return (
                  <RadioGroupPrimitive.Root
                    key={row.id}
                    asChild
                    value={selectedColumnId}
                    onValueChange={(newColumnId) => {
                      handleRowChange(row.id, newColumnId);
                    }}
                    name={rowGroupId}
                    disabled={disabled}
                    required={required}
                    aria-invalid={Boolean(errorMessage)}>
                    <tr className={cn("relative", baseBgColor, rowHasError ? "bg-destructive-muted" : "")}>
                      {/* Row label */}
                      <th scope="row" className={cn("p-2 align-middle", !rowHasError && "rounded-l-input")}>
                        <div className="flex flex-col gap-0 leading-none">
                          <Label>{row.label}</Label>
                          {rowHasError ? (
                            <span className="text-destructive text-xs font-normal">Select one option</span>
                          ) : null}
                        </div>
                      </th>
                      {/* Column options for this row */}
                      {columns.map((column, colIndex) => {
                        const cellId = `${rowGroupId}-${column.id}`;
                        const isLastColumn = colIndex === columns.length - 1;

                        return (
                          <td
                            key={column.id}
                            className={cn(
                              "p-2 text-center align-middle",
                              isLastColumn && !rowHasError && "rounded-r-input"
                            )}>
                            <Label htmlFor={cellId} className="flex cursor-pointer justify-center">
                              <RadioGroupItem
                                value={column.id}
                                required={required}
                                id={cellId}
                                disabled={disabled}
                                aria-label={`${row.label}-${column.label}`}
                              />
                            </Label>
                          </td>
                        );
                      })}
                    </tr>
                  </RadioGroupPrimitive.Root>
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
