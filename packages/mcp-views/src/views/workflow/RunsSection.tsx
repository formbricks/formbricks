import type { FormatContext } from "../../shared/format";
import { Badge, Button, Loading } from "../../shared/ui";
import { DetailList } from "./DetailList";
import type { Loaded } from "./calls";
import type { RunDetail, RunSummary } from "./model";
import {
  buildStepOutcomes,
  describeRunDuration,
  describeRunFailure,
  describeRunStart,
  describeRunTrigger,
  describeTriggerPayload,
  getRunStatusStyle,
  getStepStatusStyle,
  summarizeRuns,
} from "./runs";

export type DetailState = { status: "loading" } | ({ status: "done" } & Loaded<RunDetail>);

const RunDetailPanel = ({
  run,
  stepNames,
}: Readonly<{ run: RunDetail; stepNames: ReadonlyMap<string, string> }>) => {
  const outcomes = buildStepOutcomes(run.logs, stepNames);
  return (
    <div className="fb-stack">
      <DetailList details={describeTriggerPayload(run)} />
      <h4 className="wf-subsection-title">Steps</h4>
      {outcomes.length === 0 ? (
        <p className="fb-muted">No steps ran yet.</p>
      ) : (
        <ol className="wf-outcomes">
          {outcomes.map((outcome) => {
            const status = getStepStatusStyle(outcome.status);
            return (
              <li key={outcome.id} className="wf-outcome">
                <div className="fb-row">
                  <span className="wf-outcome-name">{outcome.name}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {outcome.duration ? <span className="fb-faint">{outcome.duration}</span> : null}
                </div>
                {outcome.error ? <p className="wf-failure">{outcome.error}</p> : null}
                {outcome.input.length > 0 ? (
                  <>
                    <p className="fb-faint">Input</p>
                    <DetailList details={outcome.input} />
                  </>
                ) : null}
                {outcome.output.length > 0 ? (
                  <>
                    <p className="fb-faint">Output</p>
                    <DetailList details={outcome.output} />
                  </>
                ) : null}
                {outcome.hiddenFields > 0 ? (
                  <p className="fb-faint">{outcome.hiddenFields} more fields not shown.</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

interface RunsSectionProps extends FormatContext {
  runs: RunSummary[];
  runsError: string | null;
  openRunId: string | null;
  details: Partial<Record<string, DetailState>>;
  stepNames: ReadonlyMap<string, string>;
  refreshing: boolean;
  onToggle: (runId: string) => void;
  onRetryDetail: (runId: string) => void;
  onRefresh: () => void;
}

export const RunsSection = ({
  runs,
  runsError,
  openRunId,
  details,
  stepNames,
  refreshing,
  onToggle,
  onRetryDetail,
  onRefresh,
  locale,
  timeZone,
}: Readonly<RunsSectionProps>) => (
  <section className="fb-stack" aria-labelledby="wf-runs-heading">
    <div className="fb-row fb-spread">
      <div>
        <h2 id="wf-runs-heading" className="wf-section-title">
          Recent runs
        </h2>
        <p className="fb-faint">{summarizeRuns(runs)}</p>
      </div>
      <Button onClick={onRefresh} disabled={refreshing}>
        {refreshing ? "Refreshing…" : "Refresh runs"}
      </Button>
    </div>

    {runsError ? (
      <div className="fb-notice fb-notice-danger" role="alert">
        {runsError}
      </div>
    ) : null}

    {runs.length === 0 ? (
      runsError ? null : (
        <p className="fb-muted">
          This workflow has not run yet. A test run or a completed response starts one.
        </p>
      )
    ) : (
      <ul className="wf-runs">
        {runs.map((run) => {
          const status = getRunStatusStyle(run.status);
          const failure = describeRunFailure(run);
          const open = openRunId === run.id;
          const detail = details[run.id];
          const panelId = `wf-run-${run.id}`;
          return (
            <li key={run.id} className="wf-run">
              <button
                type="button"
                className="wf-run-head"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => onToggle(run.id)}>
                <span className="wf-run-main">
                  <span className="fb-row">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {run.isDryRun ? <Badge>Test</Badge> : null}
                    <span className="wf-run-time">{describeRunStart(run, { locale, timeZone })}</span>
                  </span>
                  <span className="fb-faint">
                    {describeRunTrigger(run)} · {describeRunDuration(run)}
                  </span>
                  {failure ? <span className="wf-failure">{failure}</span> : null}
                </span>
                <span className="wf-chevron" aria-hidden="true" />
              </button>
              {open ? (
                <div id={panelId} className="wf-run-panel">
                  {!detail || detail.status === "loading" ? (
                    <Loading label="Loading run…" />
                  ) : detail.ok ? (
                    <RunDetailPanel run={detail.value} stepNames={stepNames} />
                  ) : (
                    <div className="fb-stack">
                      <div className="fb-notice fb-notice-danger" role="alert">
                        {detail.error}
                      </div>
                      <div>
                        <Button onClick={() => onRetryDetail(run.id)}>Try again</Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    )}
  </section>
);
