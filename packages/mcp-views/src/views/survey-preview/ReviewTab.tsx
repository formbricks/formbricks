import type { App } from "@modelcontextprotocol/ext-apps";
import { useId, useMemo, useState } from "react";
import { Badge, Button, Notice } from "../../shared/ui";
import { buildChangeRequest } from "./change-request";
import {
  type Formatters,
  type OutlineBlock,
  type OutlineEnding,
  buildOutline,
  buildSettingLines,
  describeShowConditions,
} from "./outline";
import type { ShowSurveyData } from "./types";

interface ReviewTabProps {
  data: ShowSurveyData;
  languageCode: string;
  formatters: Formatters;
  app: App | null;
  canMessage: boolean;
  canOpenLinks: boolean;
}

const BlockItem = ({ block }: Readonly<{ block: OutlineBlock }>) => (
  <li className="sp-block">
    <div className="sp-block-head">
      <span>Block {block.number}</span>
      {block.name ? <span className="fb-faint">{block.name}</span> : null}
    </div>
    <ol className="sp-questions">
      {block.questions.map((question) => (
        <li key={question.id} className="sp-question">
          <span className="sp-number">{question.number}.</span>
          <div>
            <div className="sp-headline">{question.headline || "(no headline)"}</div>
            {question.description ? <div className="sp-detail">{question.description}</div> : null}
            <div className="sp-meta">
              <Badge>{question.typeLabel}</Badge>
              <Badge tone={question.required ? "info" : "neutral"}>
                {question.required ? "Required" : "Optional"}
              </Badge>
              {question.missingTranslation ? <Badge tone="warning">Not translated</Badge> : null}
            </div>
            {question.details.map((detail) => (
              <div key={detail} className="sp-detail">
                {detail}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ol>
    {block.logic.length > 0 || block.fallback ? (
      <ul className="sp-logic" aria-label={`Logic of block ${block.number}`}>
        {block.logic.map((sentence) => (
          <li key={sentence}>
            <span className="sp-logic-label">Logic: </span>
            {sentence}
          </li>
        ))}
        {block.fallback ? <li>{block.fallback}</li> : null}
      </ul>
    ) : null}
  </li>
);

const EndingItem = ({ ending }: Readonly<{ ending: OutlineEnding }>) => (
  <li className="sp-block">
    <div className="sp-question">
      <span className="sp-number">{ending.number}.</span>
      <div>
        <div className="sp-headline">{ending.title || "(no headline)"}</div>
        {ending.detail ? <div className="sp-detail">{ending.detail}</div> : null}
        <div className="sp-meta">
          <Badge>{ending.kind === "redirect" ? "Redirect" : "Ending screen"}</Badge>
        </div>
      </div>
    </div>
  </li>
);

const ChangeRequest = ({
  data,
  languageCode,
  app,
}: Readonly<{ data: ShowSurveyData; languageCode: string; app: App | null }>) => {
  const outline = useMemo(() => buildOutline(data.survey, languageCode), [data.survey, languageCode]);
  const [about, setAbout] = useState("survey");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const aboutId = useId();
  const textId = useId();
  const questions = outline.blocks.flatMap((block) => block.questions);

  const send = async () => {
    if (!app || !text.trim()) return;
    const target = questions.find((question) => question.id === about);
    setStatus("sending");
    try {
      const result = await app.sendMessage({
        role: "user",
        content: [
          {
            type: "text",
            text: buildChangeRequest({
              surveyId: data.survey.id,
              surveyName: data.survey.name,
              target: target ? { number: target.number, headline: target.headline } : null,
              request: text,
            }),
          },
        ],
      });
      if (result.isError) {
        setStatus("failed");
        return;
      }
      setText("");
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="sp-change">
      <div className="sp-section-title">Ask for a change</div>
      <div className="fb-row">
        <label className="sp-field-label" htmlFor={aboutId}>
          About
        </label>
        <select
          id={aboutId}
          className="sp-select"
          value={about}
          onChange={(event) => setAbout(event.target.value)}>
          <option value="survey">The whole survey</option>
          {questions.map((question) => (
            <option key={question.id} value={question.id}>
              {`Question ${question.number}${question.headline ? `: ${question.headline.slice(0, 40)}` : ""}`}
            </option>
          ))}
        </select>
      </div>
      <label className="fb-sr-only" htmlFor={textId}>
        What should change
      </label>
      <textarea
        id={textId}
        className="sp-textarea"
        placeholder="What should change?"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (status !== "idle") setStatus("idle");
        }}
      />
      <div className="fb-row">
        <Button
          variant="primary"
          disabled={!text.trim() || status === "sending"}
          onClick={() => {
            void send();
          }}>
          Send to the agent
        </Button>
        {status === "sent" ? (
          <span className="fb-muted" role="status">
            Sent. The agent will pick it up in the chat.
          </span>
        ) : null}
        {status === "failed" ? (
          <span className="fb-muted" role="alert">
            The chat did not accept the message. Say it in the chat instead.
          </span>
        ) : null}
      </div>
    </div>
  );
};

export const ReviewTab = ({
  data,
  languageCode,
  formatters,
  app,
  canMessage,
  canOpenLinks,
}: Readonly<ReviewTabProps>) => {
  const outline = useMemo(() => buildOutline(data.survey, languageCode), [data.survey, languageCode]);
  const settingLines = useMemo(
    () => buildSettingLines(data.survey, data.meta?.settings ?? null, formatters),
    [data.survey, data.meta, formatters]
  );
  const showConditions = useMemo(() => describeShowConditions(data.survey), [data.survey]);
  const facts = [
    ...settingLines,
    ...(showConditions ? [{ label: "Shows when", value: showConditions }] : []),
  ];
  const surveyUrl = data.meta?.surveyUrl ?? null;

  return (
    <div className="fb-stack">
      {facts.length > 0 ? (
        <section className="sp-section" aria-label="Settings">
          <h2 className="sp-section-title">Settings</h2>
          <dl className="sp-facts">
            {facts.map((fact, index) => (
              <div key={`${fact.label}-${index}`} style={{ display: "contents" }}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="sp-section" aria-label="Questions">
        <h2 className="sp-section-title">
          {outline.questionCount} {outline.questionCount === 1 ? "question" : "questions"} in{" "}
          {outline.blocks.length} {outline.blocks.length === 1 ? "block" : "blocks"}
        </h2>
        {outline.welcome ? (
          <div className="sp-block">
            <div className="sp-question">
              <span className="sp-number" aria-hidden="true" />
              <div>
                <div className="sp-headline">{outline.welcome.headline || "Welcome"}</div>
                {outline.welcome.description ? (
                  <div className="sp-detail">{outline.welcome.description}</div>
                ) : null}
                <div className="sp-meta">
                  <Badge>Welcome screen</Badge>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {outline.blocks.length > 0 ? (
          <ol className="sp-list">
            {outline.blocks.map((block) => (
              <BlockItem key={block.id} block={block} />
            ))}
          </ol>
        ) : (
          <Notice>This survey has no questions yet.</Notice>
        )}
      </section>

      {outline.endings.length > 0 ? (
        <section className="sp-section" aria-label="Endings">
          <h2 className="sp-section-title">Endings</h2>
          <ol className="sp-list">
            {outline.endings.map((ending) => (
              <EndingItem key={ending.id} ending={ending} />
            ))}
          </ol>
        </section>
      ) : null}

      {outline.hiddenFields.length > 0 ? (
        <section className="sp-section" aria-label="Hidden fields">
          <h2 className="sp-section-title">Hidden fields</h2>
          <div className="sp-chips">
            {outline.hiddenFields.map((field) => (
              <span key={field} className="sp-chip">
                {field}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {outline.variables.length > 0 ? (
        <section className="sp-section" aria-label="Variables">
          <h2 className="sp-section-title">Variables</h2>
          <div className="sp-chips">
            {outline.variables.map((variable) => (
              <span key={variable} className="sp-chip">
                {variable}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {canMessage ? <ChangeRequest data={data} languageCode={languageCode} app={app} /> : null}

      {surveyUrl && canOpenLinks && app ? (
        <div className="fb-row">
          <Button
            onClick={() => {
              void app.openLink({ url: surveyUrl });
            }}>
            Open survey
          </Button>
          <span className="fb-faint">Opens the public link in your browser.</span>
        </div>
      ) : null}
    </div>
  );
};
