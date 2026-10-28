import { useState } from "react";
import { Badge } from "../../shared/ui";
import { truncate } from "./cells";
import { type Display, formatDateTime, typeLabel } from "./format";
import type { ViewColumn, ViewRow } from "./types";

/** Cell text longer than this is clipped in the table and expands in place. */
const CLIP_CHARS = 90;

interface ResponsesTableProps {
  surveyName: string;
  columns: ViewColumn[];
  rows: ViewRow[];
  display: Display;
  selectedId: string | undefined;
  busy: boolean;
  onOpen: (id: string) => void;
}

interface CellProps {
  text: string;
  expanded: boolean;
  onToggle: () => void;
}

const Cell = ({ text, expanded, onToggle }: Readonly<CellProps>) => {
  if (text === "") {
    return (
      <>
        <span className="fb-faint" aria-hidden="true">
          —
        </span>
        <span className="fb-sr-only">No answer</span>
      </>
    );
  }
  const clipped = text.length > CLIP_CHARS;
  return (
    <span className="rv-cell">
      <span className="rv-cell-text">{clipped && !expanded ? truncate(text, CLIP_CHARS) : text}</span>
      {clipped ? (
        <button
          type="button"
          className="rv-more"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}>
          {expanded ? "Less" : "More"}
        </button>
      ) : null}
    </span>
  );
};

export const ResponsesTable = ({
  surveyName,
  columns,
  rows,
  display,
  selectedId,
  busy,
  onOpen,
}: Readonly<ResponsesTableProps>) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div
      className="fb-table-wrap rv-scroll"
      role="region"
      aria-label="Responses table, scrolls sideways"
      aria-busy={busy}
      data-busy={busy}>
      <table className="fb-table rv-table">
        <caption className="fb-sr-only">Responses to {surveyName}</caption>
        <thead>
          <tr>
            <th scope="col" className="rv-sticky rv-sticky-head">
              Submitted
            </th>
            <th scope="col">Status</th>
            {columns.map((column) => (
              <th key={column.id} scope="col" className="rv-question-head">
                <span className="rv-question-label" title={column.label}>
                  {column.label}
                </span>
                <span className="rv-question-type">{typeLabel(column.type)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.id === selectedId ? "rv-selected" : undefined}
              onClick={() => onOpen(row.id)}>
              <th scope="row" className="rv-sticky">
                <button
                  type="button"
                  id={`rv-open-${row.id}`}
                  className="rv-open"
                  aria-current={row.id === selectedId ? "true" : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(row.id);
                  }}>
                  {formatDateTime(row.createdAt, display)}
                </button>
              </th>
              <td>
                <Badge tone={row.finished ? "success" : "warning"}>
                  {row.finished ? "Finished" : "Partial"}
                </Badge>
              </td>
              {columns.map((column) => {
                const key = `${row.id}:${column.id}`;
                return (
                  <td key={column.id} className="rv-answer">
                    <Cell
                      text={row.cells[column.id] ?? ""}
                      expanded={expanded.has(key)}
                      onToggle={() => toggle(key)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
