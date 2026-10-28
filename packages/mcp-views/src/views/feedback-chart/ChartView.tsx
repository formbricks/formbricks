import type { App as McpApp } from "@modelcontextprotocol/ext-apps";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card } from "../../shared/ui";
import { BarChart } from "./BarChart";
import { BigNumbers } from "./BigNumbers";
import { DataTable } from "./DataTable";
import { LineChart } from "./LineChart";
import { PieChart } from "./PieChart";
import type { FormatContext } from "./format";
import type { FeedbackChartModel } from "./model";
import { buildDigDeeperPrompt, describeScope } from "./prompt";
import { buildCartesian, buildNumbers, buildPie } from "./series";
import { describeCartesianPoint, describePieSlice } from "./tooltip";
import type { PointContext, Selection } from "./tooltip";
import { useElementWidth } from "./use-element-width";

type SendState = "idle" | "sending" | "sent" | "failed";

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

export const ChartView = ({
  model,
  app,
  context,
  theme,
}: Readonly<{
  model: FeedbackChartModel;
  app: McpApp | null;
  context: FormatContext;
  theme: "light" | "dark";
}>) => {
  const { spec } = model;
  const bodyRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(bodyRef);
  const [showTable, setShowTable] = useState(spec.type === "table");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [sendState, setSendState] = useState<SendState>("idle");

  // A new result is a new chart: nothing from the previous one stays selected.
  useEffect(() => {
    setSelection(null);
    setSendState("idle");
    setShowTable(spec.type === "table");
  }, [model, spec.type]);

  const { locale, timeZone } = context;
  const stableContext = useMemo<FormatContext>(() => ({ locale, timeZone }), [locale, timeZone]);

  const isCartesian = spec.type === "bar" || spec.type === "line" || spec.type === "area";
  const cartesian = useMemo(
    () => (isCartesian ? buildCartesian(model, stableContext) : undefined),
    [isCartesian, model, stableContext]
  );
  const pie = useMemo(
    () => (spec.type === "pie" ? buildPie(model, stableContext) : undefined),
    [model, spec.type, stableContext]
  );
  const numbers = useMemo(
    () => (spec.type === "number" ? buildNumbers(model, stableContext) : undefined),
    [model, spec.type, stableContext]
  );

  const labelOf = (id: string | undefined): string | undefined =>
    model.columns.find((column) => column.id === id)?.label;
  const pointContext: PointContext = {
    chartTitle: spec.title,
    xLabel: labelOf(spec.x) ?? "Value",
    measureLabel: labelOf(spec.y[0]) ?? "Value",
    ...(spec.series ? { seriesLabel: labelOf(spec.series) ?? spec.series } : {}),
    ...(spec.granularity ? { granularity: spec.granularity } : {}),
  };

  let target = undefined;
  if (selection && cartesian)
    target = describeCartesianPoint(cartesian, selection, pointContext, stableContext);
  else if (selection && pie) target = describePieSlice(pie, selection, pointContext, stableContext);

  const canMessage = Boolean(app?.getHostCapabilities()?.message);

  const select = (next: Selection | null) => {
    setSelection(next);
    setSendState("idle");
  };

  const send = async () => {
    if (!app || !target) return;
    setSendState("sending");
    try {
      const response = await app.sendMessage({
        role: "user",
        content: [{ type: "text", text: buildDigDeeperPrompt(target) }],
      });
      setSendState(response.isError ? "failed" : "sent");
    } catch {
      setSendState("failed");
    }
  };

  const drawable =
    (cartesian && cartesian.categories.length > 0 && cartesian.series.length > 0) ||
    (pie && pie.slices.length > 0) ||
    (numbers && numbers.length > 0);
  const tableOnly = spec.type === "table" || !drawable;

  const notes: string[] = [];
  if (cartesian && cartesian.hiddenSeries > 0) {
    notes.push(
      `${cartesian.hiddenSeries} smaller ${plural(cartesian.hiddenSeries, "series is", "series are")} not drawn; the table view has ${plural(cartesian.hiddenSeries, "it", "them")}.`
    );
  }
  if (cartesian && cartesian.hiddenCategories > 0) {
    notes.push(
      `Showing the first ${cartesian.categories.length} categories; ${cartesian.hiddenCategories} more ${plural(cartesian.hiddenCategories, "is", "are")} in the table view.`
    );
  }
  if (pie && pie.skipped > 0) {
    notes.push(
      `${pie.skipped} ${plural(pie.skipped, "group has", "groups have")} no positive value and ${plural(pie.skipped, "is", "are")} not drawn.`
    );
  }
  if (spec.omittedMeasures && spec.omittedMeasures.length > 0) {
    notes.push(
      `Not plotted: ${spec.omittedMeasures.map((id) => labelOf(id) ?? id).join(", ")}. Charts draw one scale at a time; the table view has them.`
    );
  }
  if (spec.type !== "table" && !drawable) {
    notes.push("There is nothing to draw for this result, so it is shown as a table.");
  }

  const limit = typeof model.query?.limit === "number" ? model.query.limit : undefined;
  const subtitle = [
    model.datasetName,
    ...describeScope(model.query, stableContext),
    `${model.rows.length} ${plural(model.rows.length, "row", "rows")}`,
  ].filter(Boolean);

  return (
    <Card className="fbc">
      <div className="fbc-body">
        <div className="fbc-head">
          <div className="fbc-head-text">
            <h1 className="fb-title fbc-title">{spec.title}</h1>
            <p className="fbc-sub">{subtitle.join(" · ")}</p>
          </div>
          {tableOnly ? null : (
            <Button aria-pressed={showTable} onClick={() => setShowTable((current) => !current)}>
              {showTable ? "View as chart" : "View as table"}
            </Button>
          )}
        </div>

        {model.truncated ? (
          <p className="fbc-note-warning" role="status">
            {limit
              ? `The query reached its limit of ${limit} rows, so there may be more groups than shown.`
              : "The query reached its row limit, so there may be more groups than shown."}{" "}
            Ask the agent for a narrower query to see the rest.
          </p>
        ) : null}

        <div ref={bodyRef} className="fbc-stack-tight">
          {tableOnly || showTable ? (
            <DataTable model={model} context={stableContext} />
          ) : (
            <>
              {cartesian && spec.type === "bar" ? (
                <BarChart
                  data={cartesian}
                  title={spec.title}
                  width={width}
                  context={stableContext}
                  selection={selection}
                  onSelect={select}
                />
              ) : null}
              {cartesian && (spec.type === "line" || spec.type === "area") ? (
                <LineChart
                  data={cartesian}
                  kind={spec.type}
                  title={spec.title}
                  width={width}
                  context={stableContext}
                  selection={selection}
                  onSelect={select}
                />
              ) : null}
              {pie ? (
                <PieChart
                  pie={pie}
                  title={spec.title}
                  measureLabel={pointContext.measureLabel}
                  theme={theme}
                  width={width}
                  context={stableContext}
                  selection={selection}
                  onSelect={select}
                />
              ) : null}
              {numbers ? <BigNumbers numbers={numbers} /> : null}
              <DataTable model={model} context={stableContext} visuallyHidden />
            </>
          )}
        </div>

        {target ? (
          <div className="fbc-selection" role="status">
            <p className="fbc-selection-text">
              <strong>{target.xValue}</strong>
              {target.seriesValue ? ` · ${target.seriesValue}` : ""}
              {` · ${target.measureLabel}: `}
              <strong>{target.valueText}</strong>
              {sendState === "sent" ? <span className="fbc-hint"> Sent to the agent.</span> : null}
              {sendState === "failed" ? (
                <span className="fbc-hint"> The host did not accept the message.</span>
              ) : null}
            </p>
            <div className="fbc-selection-actions">
              {canMessage ? (
                <Button
                  variant="primary"
                  disabled={sendState === "sending" || sendState === "sent"}
                  onClick={send}>
                  Ask the agent to break this down
                </Button>
              ) : null}
              <Button onClick={() => select(null)}>Clear selection</Button>
            </div>
          </div>
        ) : !tableOnly && !showTable && (cartesian || pie) && canMessage ? (
          <p className="fbc-hint">Select a value, then ask the agent to break it down.</p>
        ) : null}

        {notes.length > 0 ? (
          <ul className="fbc-notes">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
};
