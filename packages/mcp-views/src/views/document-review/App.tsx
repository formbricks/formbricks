import type { App as McpApp } from "@modelcontextprotocol/ext-apps";
import { type ReactNode, useId, useMemo, useState } from "react";
import { type ToolResult, getResultText } from "../../shared/tool-result";
import { Badge, Button, Card, Loading } from "../../shared/ui";
import { useToolView } from "../../shared/use-tool-view";
import {
  type ApplyOutcome,
  type ChangeGroup,
  type DocumentReview,
  type ReviewChange,
  buildOutcomeNote,
  buildPushArguments,
  capitalize,
  describeValue,
  formatCount,
  formatTimestamp,
  getApprovalBlock,
  getConfirmLabel,
  getDocumentLabel,
  getReviewedArguments,
  groupChanges,
  isLongValue,
  readApplyOutcome,
  readReview,
} from "./review";
import "./review.css";

type Phase =
  | { type: "review" }
  | { type: "applying" }
  | { type: "applied"; outcome: Extract<ApplyOutcome, { ok: true }> }
  | { type: "failed"; outcome: Extract<ApplyOutcome, { ok: false }> }
  | { type: "declined" };

// Joined by hand: the Prettier class sorter rewrites class names inside template strings and drops the
// space that separates a conditional class from the one before it.
const classNames = (...names: (string | false | undefined)[]): string => names.filter(Boolean).join(" ");

// A path breaks after its dots and brackets first, so a narrow chat column wraps it between fields.
const breakablePath = (path: string): ReactNode =>
  path.split(/(?<=[.\]])/).flatMap((part, index) => (index === 0 ? [part] : [<wbr key={index} />, part]));

const KIND_LABEL: Record<ReviewChange["kind"], string> = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
};

const Value = ({ label, value }: Readonly<{ label: string; value: unknown }>) => {
  const text = describeValue(value);
  const long = isLongValue(text);
  const [expanded, setExpanded] = useState(false);
  const id = useId();

  return (
    <div className="dr-value">
      <span className="dr-value-label">{label}</span>
      <pre id={id} className={classNames("dr-pre", long && !expanded && "dr-pre-collapsed")}>
        {text}
      </pre>
      {long ? (
        <button
          type="button"
          className="dr-link"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((previous) => !previous)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
};

const ChangeRow = ({ change }: Readonly<{ change: ReviewChange }>) => {
  const hasBefore = change.kind !== "added";
  const hasAfter = change.kind !== "removed";
  return (
    <li className={classNames("dr-change", change.destructive && "dr-change-destructive")}>
      <div className="fb-row">
        <Badge tone={change.kind === "added" ? "success" : change.kind === "removed" ? "danger" : "info"}>
          {KIND_LABEL[change.kind]}
        </Badge>
        {change.destructive ? <Badge tone="warning">Destructive</Badge> : null}
        <code className="dr-path">{breakablePath(change.path)}</code>
      </div>
      {change.reason ? <p className="dr-reason">{change.reason}</p> : null}
      <div className="dr-values">
        {hasBefore ? <Value label="Before" value={change.before} /> : null}
        {hasAfter ? <Value label="After" value={change.after} /> : null}
      </div>
    </li>
  );
};

const Group = ({ group }: Readonly<{ group: ChangeGroup }>) => (
  <section className="dr-group" aria-label={group.label}>
    <h3 className="dr-group-title">
      {group.label} <span className="fb-faint">({group.changes.length})</span>
    </h3>
    <ul className="dr-list">
      {group.changes.map((change) => (
        <ChangeRow key={`${change.kind}:${change.path}`} change={change} />
      ))}
    </ul>
  </section>
);

const Alert = ({
  tone,
  title,
  children,
}: Readonly<{
  tone: "warning" | "danger" | "success" | "neutral";
  title?: string;
  children?: ReactNode;
}>) => (
  <div
    className={classNames("fb-notice", "dr-alert", `dr-alert-${tone}`)}
    role={tone === "neutral" || tone === "success" ? "status" : "alert"}>
    {title ? <p className="dr-alert-title">{title}</p> : null}
    {children}
  </div>
);

const Issues = ({ issues }: Readonly<{ issues: { name: string; reason: string }[] }>) =>
  issues.length > 0 ? (
    <ul className="dr-issues">
      {issues.map((issue) => (
        <li key={`${issue.name}:${issue.reason}`}>
          <code className="dr-path">{issue.name}</code> {issue.reason}
        </li>
      ))}
    </ul>
  ) : null;

const notifyModel = (app: McpApp, text: string, asMessage: boolean): void => {
  const content = [{ type: "text" as const, text }];
  const canMessage = Boolean(app.getHostCapabilities()?.message);
  const send =
    asMessage && canMessage
      ? app.sendMessage({ role: "user", content })
      : app.updateModelContext({ content });
  // Telling the model is best effort: the decision itself is already on screen and, for an approval,
  // already on the server.
  send.catch(() => undefined);
};

const ReviewView = ({
  review,
  input,
  app,
  locale,
  timeZone,
}: Readonly<{
  review: DocumentReview;
  input: Record<string, unknown> | null;
  app: McpApp;
  locale?: string;
  timeZone?: string;
}>) => {
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ type: "review" });
  const confirmId = useId();
  const hintId = useId();

  const reviewed = getReviewedArguments(input, review);
  const block = getApprovalBlock(review, reviewed, confirmed);
  const staleAfterPush = phase.type === "failed" && phase.outcome.stale;
  const settled = phase.type === "applied" || phase.type === "declined";
  const busy = phase.type === "applying";
  const documentLabel = getDocumentLabel(review.kind);
  const groups = groupChanges(review.changes);
  const { summary } = review;

  const approve = async () => {
    if (!reviewed.ok || block || busy) return;
    setPhase({ type: "applying" });
    let outcome: ApplyOutcome;
    try {
      // Exactly the reviewed arguments; `confirmDestructive` only if the person ticked the box.
      const result = await app.callServerTool({
        name: "push_document",
        arguments: buildPushArguments(reviewed.args, confirmed),
      });
      outcome = readApplyOutcome(result as ToolResult);
    } catch (error) {
      outcome = {
        ok: false,
        stale: false,
        title: "The push did not go through",
        detail:
          error instanceof Error && error.message ? error.message : "The host could not reach the server.",
        issues: [],
      };
    }
    setPhase(outcome.ok ? { type: "applied", outcome } : { type: "failed", outcome });
    notifyModel(app, buildOutcomeNote(review, outcome), false);
  };

  const decline = () => {
    setPhase({ type: "declined" });
    notifyModel(app, buildOutcomeNote(review, "declined"), true);
  };

  return (
    <Card>
      <div className="fb-stack">
        <header className="fb-stack dr-header">
          <div className="fb-row fb-spread">
            <h1 className="fb-title dr-name">
              Review change to {documentLabel} <span className="dr-name-quoted">“{review.name}”</span>
            </h1>
            {review.status === "valid" || review.status === "destructive" ? (
              <Badge tone={review.status === "destructive" ? "warning" : "neutral"}>
                {review.status === "destructive" ? "Removes data" : "Ready to review"}
              </Badge>
            ) : (
              <Badge tone={review.status === "stale" ? "warning" : "danger"}>
                {review.status === "stale" ? "Out of date" : "Not valid"}
              </Badge>
            )}
          </div>
          <p className="fb-faint">
            Stored version from {formatTimestamp(review.updatedAt, locale, timeZone)}
            {" · "}
            <span className="fb-mono dr-id">{review.id}</span>
          </p>
        </header>

        {summary.total > 0 ? (
          <div className="fb-row" aria-label="Summary of changes">
            <Badge>
              {formatCount(summary.total, locale)} {summary.total === 1 ? "change" : "changes"}
            </Badge>
            {summary.added > 0 ? (
              <Badge tone="success">{formatCount(summary.added, locale)} added</Badge>
            ) : null}
            {summary.removed > 0 ? (
              <Badge tone="danger">{formatCount(summary.removed, locale)} removed</Badge>
            ) : null}
            {summary.changed > 0 ? (
              <Badge tone="info">{formatCount(summary.changed, locale)} changed</Badge>
            ) : null}
            {summary.destructive > 0 ? (
              <Badge tone="warning">{formatCount(summary.destructive, locale)} destructive</Badge>
            ) : null}
          </div>
        ) : null}

        {review.status === "stale" || staleAfterPush ? (
          <Alert tone="warning" title="The document changed since the agent read it">
            <p>
              Ask the agent to pull it again and redo the change. Nothing was written. The changes below are
              measured against the version stored now.
            </p>
          </Alert>
        ) : null}

        {review.status === "invalid" ? (
          <Alert tone="danger" title="The server would refuse this change">
            {review.detail ? <p>{review.detail}</p> : null}
            <Issues issues={review.issues} />
            <p>Ask the agent to fix the document and review it again.</p>
          </Alert>
        ) : null}

        {review.status !== "invalid" && summary.total === 0 ? (
          <Alert tone="neutral">
            <p>No changes: the proposed {documentLabel} is the same as the stored one.</p>
          </Alert>
        ) : null}

        {groups.length > 0 ? (
          // The list scrolls, so keyboard users need to be able to focus it to scroll it.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <div className="dr-changes" tabIndex={0} role="region" aria-label="Changes">
            {groups.map((group) => (
              <Group key={group.key} group={group} />
            ))}
            {review.omittedChanges > 0 ? (
              <p className="fb-muted dr-omitted">
                {formatCount(review.omittedChanges, locale)} more{" "}
                {review.omittedChanges === 1 ? "change is" : "changes are"} not listed here.
              </p>
            ) : null}
          </div>
        ) : null}

        {review.status === "destructive" && !settled ? (
          <Alert tone="warning" title="This change removes data">
            <ul className="dr-issues">
              {review.destructive.map((item) => (
                <li key={`${item.type}:${item.ids.join(",")}`}>
                  <strong>{capitalize(item.removes)}.</strong> {item.detail}
                </li>
              ))}
            </ul>
            <label className="dr-confirm" htmlFor={confirmId}>
              <input
                id={confirmId}
                type="checkbox"
                checked={confirmed}
                disabled={busy || staleAfterPush}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>{getConfirmLabel(review)}</span>
            </label>
          </Alert>
        ) : null}

        {phase.type === "failed" && !phase.outcome.stale ? (
          <Alert tone="danger" title={phase.outcome.title}>
            <p>{phase.outcome.detail}</p>
            <Issues issues={phase.outcome.issues} />
            <p className="fb-faint">
              Nothing was written.{phase.outcome.requestId ? ` Request ${phase.outcome.requestId}.` : ""}
            </p>
          </Alert>
        ) : null}

        {phase.type === "applied" ? (
          <Alert tone="success" title="Applied">
            <p>
              The {documentLabel} now has your changes. It was last updated{" "}
              {formatTimestamp(phase.outcome.updatedAt, locale, timeZone)}.
            </p>
          </Alert>
        ) : null}

        {phase.type === "declined" ? (
          <Alert tone="neutral" title="Declined">
            <p>Nothing was pushed. The agent has been told.</p>
          </Alert>
        ) : null}

        {settled ? null : (
          <div className="fb-stack dr-actions">
            <div className="fb-row">
              <Button
                variant="primary"
                onClick={() => void approve()}
                disabled={Boolean(block) || busy || staleAfterPush}
                aria-describedby={block === "confirm" || block === "arguments" ? hintId : undefined}>
                {busy ? <span className="fb-spinner dr-spinner" aria-hidden="true" /> : null}
                {busy ? "Applying…" : "Approve and apply"}
              </Button>
              <Button onClick={decline} disabled={busy}>
                Cancel
              </Button>
            </div>
            {block === "confirm" ? (
              <p id={hintId} className="fb-faint">
                Tick the box above to approve this change.
              </p>
            ) : null}
            {block === "arguments" && !reviewed.ok ? (
              <p id={hintId} className="fb-faint">
                {reviewed.reason} Ask the agent to review the change again.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
};

export const App = () => {
  const { app, isConnected, connectionError, input, result, cancelledReason, hostContext } = useToolView();

  // A late tool result replaces the earlier one in state; the key restarts the decision with it.
  const shown = useMemo(() => readReview(result), [result]);

  if (connectionError) {
    return (
      <Card>
        <p role="alert">This view could not connect to the agent: {connectionError.message}</p>
      </Card>
    );
  }
  if (cancelledReason) {
    return (
      <Card>
        <p className="fb-muted">The review was cancelled before it finished.</p>
      </Card>
    );
  }
  if (!isConnected || !app || !result) {
    return <Loading label="Loading the review…" />;
  }

  if (!shown) {
    return (
      <Card>
        <div className="fb-stack">
          <h1 className="fb-title">Change review</h1>
          <p className={result.isError ? "dr-error" : "fb-muted"} role={result.isError ? "alert" : undefined}>
            {getResultText(result) ?? "The review could not be shown."}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <ReviewView
      key={`${shown.id}:${shown.expectedUpdatedAt}:${result.structuredContent ? "s" : "t"}`}
      review={shown}
      input={input}
      app={app}
      locale={hostContext?.locale}
      timeZone={hostContext?.timeZone}
    />
  );
};
