import type { FormatContext } from "../../shared/format";
import type { FeedbackChartModel } from "./model";
import { formatTableCell } from "./table";

/**
 * Every chart's equal: all the columns and rows of the result. It is the view's accessible twin, so screen
 * readers read this rather than the picture, and the one place every exact value is reachable.
 */
export const DataTable = ({
  model,
  context,
  visuallyHidden = false,
}: Readonly<{ model: FeedbackChartModel; context: FormatContext; visuallyHidden?: boolean }>) => (
  <div className={visuallyHidden ? "fb-sr-only" : "fbc-table-wrap"}>
    <table className="fbc-table">
      <caption className="fb-sr-only">{model.spec.title}</caption>
      <thead>
        <tr>
          {model.columns.map((column) => (
            <th key={column.id} scope="col" className={column.kind === "measure" ? "fbc-num" : undefined}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {model.rows.map((row, index) => (
          // Rows have no identity of their own; they are a static list that never reorders.
          <tr key={index}>
            {model.columns.map((column) => {
              const cell = formatTableCell(column, row[column.id] ?? null, model.spec, context);
              const className = [cell.numeric ? "fbc-num" : "", cell.missing ? "fbc-null" : ""]
                .filter(Boolean)
                .join(" ");
              return (
                <td key={column.id} className={className || undefined}>
                  {cell.text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
