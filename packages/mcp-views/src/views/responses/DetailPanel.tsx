import type { App } from "@modelcontextprotocol/ext-apps";
import { useEffect, useRef } from "react";
import { formatDateTime } from "../../shared/format";
import { Badge, Button, Loading } from "../../shared/ui";
import type { DetailModel } from "./detail";
import { type Display, formatDuration, typeLabel } from "./format";
import { useResponseDetail } from "./use-response-detail";

interface DetailPanelProps {
  app: App | null;
  responseId: string;
  /** Shown while the full response loads, so the header never flashes empty. */
  createdAt: string;
  display: Display;
  onClose: () => void;
}

const Answers = ({ detail }: Readonly<{ detail: DetailModel }>) => (
  <dl className="rv-answers">
    {detail.answers.map((answer) => (
      <div key={answer.id} className="rv-answer-item">
        <dt>
          {answer.label}
          <span className="rv-question-type">{typeLabel(answer.type)}</span>
        </dt>
        <dd>
          {answer.lines.length === 0 ? (
            <span className="fb-faint">No answer</span>
          ) : (
            answer.lines.map((line, index) => (
              <span key={`${answer.id}:${index}`} className="rv-line">
                {line}
              </span>
            ))
          )}
        </dd>
      </div>
    ))}
  </dl>
);

const Facts = ({ detail, display }: Readonly<{ detail: DetailModel; display: Display }>) => (
  <div className="rv-facts">
    <Badge tone={detail.finished ? "success" : "warning"}>{detail.finished ? "Finished" : "Partial"}</Badge>
    {detail.language ? <Badge>{detail.language}</Badge> : null}
    {detail.durationSeconds === null ? null : <Badge>{formatDuration(detail.durationSeconds)}</Badge>}
    {detail.tags.map((tag) => (
      <Badge key={tag} tone="info">
        {tag}
      </Badge>
    ))}
    {detail.contact ? (
      <p className="fb-faint rv-contact">
        Contact {detail.contact.userId ? `${detail.contact.userId} · ` : ""}
        <span className="fb-mono">{detail.contact.id}</span>
      </p>
    ) : null}
    {detail.updatedAt && detail.updatedAt !== detail.createdAt ? (
      <p className="fb-faint rv-contact">Updated {formatDateTime(detail.updatedAt, display)}</p>
    ) : null}
  </div>
);

export const DetailPanel = ({ app, responseId, createdAt, display, onClose }: Readonly<DetailPanelProps>) => {
  const { state, reload } = useResponseDetail(app, responseId);
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus into the panel when it opens, so a keyboard user lands on what they asked for.
  useEffect(() => {
    heading.current?.focus();
  }, [responseId]);

  return (
    <aside className="rv-detail" aria-label="Response details">
      <div className="fb-row fb-spread rv-detail-head">
        <div>
          <h2 className="fb-title" tabIndex={-1} ref={heading}>
            Response
          </h2>
          <p className="fb-faint">{formatDateTime(createdAt, display)}</p>
        </div>
        <Button onClick={onClose}>Close</Button>
      </div>

      {state.status === "loading" ? <Loading label="Loading the response…" /> : null}

      {state.status === "error" ? (
        <div className="fb-notice fb-notice-danger rv-state" role="alert">
          <p>{state.message}</p>
          <Button onClick={reload}>Try again</Button>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="fb-stack">
          <Facts detail={state.detail} display={display} />
          <Answers detail={state.detail} />
          {state.detail.embedded.length > 0 ? (
            <section aria-label="Hidden fields and variables">
              <h3 className="rv-section">Hidden fields and variables</h3>
              <dl className="rv-answers">
                {state.detail.embedded.map((datum, index) => (
                  <div key={`${datum.label}:${index}`} className="rv-answer-item">
                    <dt>{datum.label}</dt>
                    <dd>
                      <span className="rv-line">{datum.value}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
};
