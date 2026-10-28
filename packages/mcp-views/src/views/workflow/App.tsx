import { useCallback, useMemo, useState } from "react";
import { type ToolResult, getResultText } from "../../shared/tool-result";
import { Badge, Button, Card, Loading } from "../../shared/ui";
import { useToolView } from "../../shared/use-tool-view";
import { FlowSection } from "./FlowSection";
import { type DetailState, RunsSection } from "./RunsSection";
import { describeToolFailure, loadRunDetail, refreshRuns, requestTestRun } from "./calls";
import { buildFlow, buildStepNames, countSteps } from "./flow";
import { type RunSummary, type WorkflowStatus, readWorkflowView } from "./model";
import "./workflow.css";

const STATUS_BADGE: Record<WorkflowStatus, { label: string; tone: "neutral" | "success" | "warning" }> = {
  draft: { label: "Draft", tone: "neutral" },
  enabled: { label: "Enabled", tone: "success" },
  disabled: { label: "Disabled", tone: "warning" },
  archived: { label: "Archived", tone: "neutral" },
};

const Problem = ({ children }: Readonly<{ children: string }>) => (
  <div className="fb-notice fb-notice-danger" role="alert">
    {children}
  </div>
);

export const App = () => {
  const { app, isConnected, connectionError, result, cancelledReason, hostContext } = useToolView();
  // Runs fetched by "Refresh runs". Tied to the tool result they refresh, so a new result starts over.
  const [refreshed, setRefreshed] = useState<{ source: ToolResult; runs: RunSummary[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [details, setDetails] = useState<Partial<Record<string, DetailState>>>({});
  const [testRequest, setTestRequest] = useState<"idle" | "sent" | "failed">("idle");

  const view = useMemo(() => readWorkflowView(result?.structuredContent), [result]);
  const flow = useMemo(() => (view ? buildFlow(view.workflow.definition) : null), [view]);
  const stepNames = useMemo(() => (view ? buildStepNames(view.workflow.definition) : new Map()), [view]);

  const loadDetail = useCallback(
    async (runId: string) => {
      if (!app) return;
      setDetails((previous) => ({ ...previous, [runId]: { status: "loading" } }));
      const loaded = await loadRunDetail((params) => app.callServerTool(params), runId);
      setDetails((previous) => ({ ...previous, [runId]: { status: "done", ...loaded } }));
    },
    [app]
  );

  if (connectionError) {
    return <Problem>{`This view could not connect to the agent: ${connectionError.message}`}</Problem>;
  }
  if (cancelledReason) {
    return <Problem>The request was canceled before the workflow loaded.</Problem>;
  }
  if (!isConnected || !result) {
    return <Loading label="Loading workflow…" />;
  }

  const failure = describeToolFailure(result);
  if (failure) {
    return <Problem>{failure}</Problem>;
  }
  if (!view || !flow) {
    return (
      <Card>
        <p className="fb-muted">{getResultText(result) ?? "There is no workflow to show."}</p>
      </Card>
    );
  }

  const { workflow } = view;
  const runs = refreshed?.source === result ? refreshed.runs : view.recentRuns;
  const badge = STATUS_BADGE[workflow.status];
  const steps = countSteps(workflow.definition);
  const canMessage = Boolean(app?.getHostCapabilities()?.message);

  const onToggle = (runId: string) => {
    if (openRunId === runId) {
      setOpenRunId(null);
      return;
    }
    setOpenRunId(runId);
    const known = details[runId];
    if (known?.status !== "done" || !known.ok) {
      void loadDetail(runId);
    }
  };

  const onRefresh = async () => {
    if (!app) return;
    setRefreshing(true);
    setRunsError(null);
    const refresh = await refreshRuns((params) => app.callServerTool(params), workflow, openRunId);
    if (refresh.ok) {
      setRefreshed({ source: result, runs: refresh.runs });
      setDetails({});
      setOpenRunId(refresh.reloadRunId);
      if (refresh.reloadRunId) void loadDetail(refresh.reloadRunId);
    } else {
      setRunsError(refresh.error);
    }
    setRefreshing(false);
  };

  const onAskForTest = async () => {
    if (!app) return;
    setTestRequest(await requestTestRun((params) => app.sendMessage(params), workflow));
  };

  return (
    <div className="fb-stack wf-root">
      <Card>
        <div className="fb-stack">
          <div className="fb-row fb-spread">
            <h1 className="fb-title wf-name">{workflow.name}</h1>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          {workflow.description ? <p className="fb-muted wf-description">{workflow.description}</p> : null}
          <p className="fb-faint">
            {steps === 1 ? "1 step" : `${steps} steps`} ·{" "}
            {workflow.runCount === 1 ? "1 run" : `${workflow.runCount} runs`} in total
          </p>
          {canMessage ? (
            <div className="fb-row">
              <Button onClick={() => void onAskForTest()} disabled={testRequest === "sent"}>
                Ask the agent to run a test
              </Button>
              <span className="fb-faint" role="status">
                {testRequest === "sent" ? "Sent. The agent will run it in the chat." : null}
                {testRequest === "failed"
                  ? "The agent could not be reached. Ask it in the chat instead."
                  : null}
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <FlowSection flow={flow} />
      </Card>

      <Card>
        <RunsSection
          runs={runs}
          runsError={runsError ?? view.recentRunsError}
          openRunId={openRunId}
          details={details}
          stepNames={stepNames}
          refreshing={refreshing}
          onToggle={onToggle}
          onRetryDetail={(runId) => void loadDetail(runId)}
          onRefresh={() => void onRefresh()}
          locale={hostContext?.locale}
          timeZone={hostContext?.timeZone}
        />
      </Card>
    </div>
  );
};
