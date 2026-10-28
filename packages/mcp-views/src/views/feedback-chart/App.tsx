import { useMemo } from "react";
import { getResultText } from "../../shared/tool-result";
import { Card, Loading } from "../../shared/ui";
import { useToolView } from "../../shared/use-tool-view";
import { ChartView } from "./ChartView";
import "./feedback-chart.css";
import type { FormatContext } from "./format";
import { parseFeedbackChart, readChartError } from "./model";

export const App = () => {
  const { app, isConnected, connectionError, result, cancelledReason, hostContext } = useToolView();
  const locale = hostContext?.locale;
  const timeZone = hostContext?.timeZone;
  const context = useMemo<FormatContext>(() => ({ locale, timeZone }), [locale, timeZone]);
  const theme = hostContext?.theme === "dark" ? "dark" : "light";

  const error = readChartError(result);
  const model = useMemo(
    () => (result && !error ? parseFeedbackChart(result.structuredContent) : undefined),
    [result, error]
  );

  if (connectionError) {
    return (
      <Card className="fbc">
        <p className="fbc-note-danger" role="alert">
          The chart could not connect to the agent. Ask the agent to show it again.
        </p>
      </Card>
    );
  }

  if (cancelledReason && !result) {
    return (
      <Card className="fbc">
        <p className="fbc-sub" role="status">
          The chart was cancelled before it finished.
        </p>
      </Card>
    );
  }

  if (!isConnected || !result) {
    return <Loading label="Loading chart…" />;
  }

  if (error) {
    return (
      <Card className="fbc">
        <div className="fbc-body">
          <h1 className="fb-title">Could not chart this</h1>
          <p className="fbc-note-danger" role="alert">
            {error}
          </p>
          <p className="fbc-hint">Ask the agent to adjust the query or try again.</p>
        </div>
      </Card>
    );
  }

  if (!model) {
    return (
      <Card className="fbc">
        <div className="fbc-body">
          <h1 className="fb-title">Feedback chart</h1>
          <p className="fb-muted">{getResultText(result) ?? "This result has no chart to show."}</p>
        </div>
      </Card>
    );
  }

  if (model.rows.length === 0) {
    return (
      <Card className="fbc">
        <div className="fbc-empty">
          <h1 className="fb-title">{model.spec.title}</h1>
          <p className="fb-muted">No feedback matched this query.</p>
          <p className="fbc-hint">Try a wider date range or fewer filters.</p>
        </div>
      </Card>
    );
  }

  return <ChartView model={model} app={app} context={context} theme={theme} />;
};
