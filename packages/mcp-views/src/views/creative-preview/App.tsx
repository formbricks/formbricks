import type { App as McpApp } from "@modelcontextprotocol/ext-apps";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { type FormatContext, formatNumber } from "../../shared/format";
import { getResultText } from "../../shared/tool-result";
import { Badge, Button, Card, Loading } from "../../shared/ui";
import { useToolView } from "../../shared/use-tool-view";
import { PreviewStage } from "./PreviewStage";
import { sendChangeRequest } from "./change-request";
import "./creative-preview.css";
import {
  describeConditions,
  describeDestination,
  describeDisplayStatus,
  describePositions,
  describePressOutcome,
  describeSchedule,
  describeShare,
  describeShowOn,
} from "./describe";
import type { TDevice } from "./geometry";
import {
  type TCreativePreviewData,
  buildCreativeView,
  getLanguageOptions,
  readCreativePreview,
  readFailure,
} from "./model";
import { type TCreativeStatsTotals, fetchCreativeStats, formatClickRate, hasStats } from "./stats";

const TYPE_LABELS = { feedbackButton: "Feedback button", banner: "Banner" } as const;

interface ChoiceProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** A two-way switch made of real radio buttons: keyboard, focus and screen reader behaviour come with them. */
const Choice = <T extends string>({ legend, name, value, options, onChange }: Readonly<ChoiceProps<T>>) => (
  <fieldset className="cp-choice">
    <legend className="cp-choice-legend">{legend}</legend>
    <div className="cp-segments">
      {options.map((option) => (
        <label key={option.value} className="cp-segment">
          <input
            type="radio"
            name={name}
            className="fb-sr-only"
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

const Fact = ({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) => (
  <div className="cp-fact">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

type TStatsState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; totals: TCreativeStatsTotals };

/** Reads the last 30 days through the existing `get_creative_stats` tool; the view never writes. */
const useCreativeStats = (app: McpApp | null, creative: TCreativePreviewData["creative"]): TStatsState => {
  const eligible = app !== null && hasStats(creative) && Boolean(app.getHostCapabilities()?.serverTools);
  const [state, setState] = useState<TStatsState>({ status: eligible ? "loading" : "unavailable" });

  useEffect(() => {
    if (!app || !eligible) return;
    let cancelled = false;
    void fetchCreativeStats((name, args) => app.callServerTool({ name, arguments: args }), creative.id).then(
      (totals) => {
        if (cancelled) return;
        setState(totals ? { status: "ready", totals } : { status: "unavailable" });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [app, eligible, creative.id]);

  return state;
};

const StatsFact = ({ state, format }: Readonly<{ state: TStatsState; format: FormatContext }>) => {
  if (state.status === "loading") return <span className="fb-muted">Loading the last 30 days…</span>;
  if (state.status === "unavailable")
    return <span className="fb-muted">Not available for this creative here.</span>;
  const { impressions, clicks, clickRate, from, to } = state.totals;
  return (
    <>
      <span>
        {formatNumber(impressions, format)} impressions, {formatNumber(clicks, format)} clicks,{" "}
        {formatClickRate(clickRate, format)} click rate
      </span>
      <div className="fb-faint cp-block">
        {from} to {to}, UTC
      </div>
    </>
  );
};

const AskAgent = ({
  app,
  creative,
}: Readonly<{ app: McpApp; creative: TCreativePreviewData["creative"] }>) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sent, setSent] = useState<"idle" | "sent" | "failed">("idle");
  const fieldId = useId();

  const send = async () => {
    if (!text.trim()) return;
    const outcome = await sendChangeRequest({
      send: (message) => app.sendMessage({ role: "user", content: [{ type: "text", text: message }] }),
      creativeId: creative.id,
      request: text,
    });
    setSent(outcome);
    if (outcome === "sent") {
      setText("");
      setOpen(false);
    }
  };

  return (
    <div className="fb-stack cp-ask">
      {open ? (
        <>
          <label htmlFor={fieldId} className="cp-label">
            What should change?
          </label>
          <textarea
            id={fieldId}
            className="cp-textarea"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="For example: move the tab to the left edge and use a green background"
          />
          <div className="fb-row">
            <Button
              variant="primary"
              disabled={!text.trim()}
              onClick={() => {
                void send();
              }}>
              Send to the agent
            </Button>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </>
      ) : (
        <div className="fb-row">
          <Button
            onClick={() => {
              setSent("idle");
              setOpen(true);
            }}>
            Ask the agent to change something
          </Button>
        </div>
      )}
      {sent === "sent" ? (
        <p className="fb-muted" role="status">
          Sent. The agent will pick it up in the chat.
        </p>
      ) : null}
      {sent === "failed" ? (
        <p className="cp-error" role="alert">
          The message could not be sent. Type the change into the chat instead.
        </p>
      ) : null}
    </div>
  );
};

const Preview = ({
  app,
  preview,
  format,
  hostTheme,
}: Readonly<{
  app: McpApp | null;
  preview: TCreativePreviewData;
  format: FormatContext;
  hostTheme: "light" | "dark";
}>) => {
  const { creative, style, styleIsExact, triggerNames } = preview;
  const [device, setDevice] = useState<TDevice>("desktop");
  const [appearance, setAppearance] = useState<"light" | "dark">(hostTheme);
  const [language, setLanguage] = useState(creative.defaultLanguage);
  const [note, setNote] = useState("");
  const languages = getLanguageOptions(creative);
  const languageId = useId();
  const stats = useCreativeStats(app, creative);

  const view = useMemo(() => buildCreativeView(creative, style, language), [creative, style, language]);
  const onPress = useCallback(
    () => setNote(`Preview only. On a live page, ${describePressOutcome(creative.destination)}.`),
    [creative.destination]
  );
  const onDismiss = useCallback(
    () => setNote("Preview only. On a live page, dismissing hides the banner until the next page view."),
    []
  );

  const status = describeDisplayStatus(creative, format);
  const conditions = describeConditions(creative.distribution.conditions);
  const destination = describeDestination(creative.destination);
  const positions = describePositions(creative);

  return (
    <div className="fb-stack cp">
      <div className="fb-stack cp-head">
        <h1 className="fb-title cp-name">{creative.name}</h1>
        <div className="fb-row">
          <Badge>{TYPE_LABELS[creative.type]}</Badge>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
      </div>

      <div className="cp-controls">
        <Choice
          legend="Device"
          name="cp-device"
          value={device}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "phone", label: "Mobile" },
          ]}
          onChange={setDevice}
        />
        <Choice
          legend="Page appearance"
          name="cp-appearance"
          value={appearance}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          onChange={setAppearance}
        />
        {languages.length > 1 ? (
          <div className="cp-choice">
            <label className="cp-choice-legend" htmlFor={languageId}>
              Language
            </label>
            <select
              id={languageId}
              className="cp-select"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}>
              {languages.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code}
                  {option.default ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <PreviewStage
        view={view}
        device={device}
        appearance={appearance}
        onPress={onPress}
        onDismiss={onDismiss}
      />
      <div className="cp-caption">
        <p className="fb-faint">
          The page is a placeholder. The creative is drawn by the same renderer the web SDK uses.
        </p>
        <p className="fb-muted cp-note" role="status">
          {note}
        </p>
      </div>

      {styleIsExact ? null : (
        <div className="cp-callout" role="status">
          The workspace styling could not be read, so colours and sizes may differ from the live site.
        </div>
      )}
      {creative.warnings.length > 0 ? (
        <div className="cp-callout cp-callout-warning" role="status">
          <strong>Needs attention</strong>
          <ul className="cp-list">
            {creative.warnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <Card>
        <h2 className="fb-title cp-section">Display status</h2>
        <dl className="cp-facts">
          <Fact label="Status">
            <Badge tone={status.tone}>{status.label}</Badge>
            <div className="cp-block">{status.explanation}</div>
          </Fact>
          <Fact label="Shows">{describeShowOn(creative, triggerNames)}</Fact>
          <Fact label="Visitors">
            <span>{describeShare(creative.distribution.displayPercentage, format)}</span>
            {conditions ? (
              <div className="cp-block">
                {conditions.intro}
                <ul className="cp-list">
                  {conditions.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="fb-faint cp-block">No conditions: any page matches.</div>
            )}
          </Fact>
          <Fact label="Schedule">{describeSchedule(creative.schedule, format)}</Fact>
          <Fact label="Destination">
            <div className="cp-wrap">{destination.summary}</div>
            <div className="fb-faint cp-block">{destination.detail}</div>
          </Fact>
          <Fact label="Position">
            <span>{positions.desktop}</span>
            {positions.phone ? <div className="fb-faint cp-block">On phones: {positions.phone}</div> : null}
          </Fact>
          <Fact label="Languages">
            {languages
              .map((option) => (option.default ? `${option.code} (default)` : option.code))
              .join(", ")}
          </Fact>
          <Fact label="Last 30 days">
            <StatsFact state={stats} format={format} />
          </Fact>
        </dl>
      </Card>

      {app?.getHostCapabilities()?.message ? <AskAgent app={app} creative={creative} /> : null}
    </div>
  );
};

export const App = () => {
  const { app, isConnected, connectionError, result, cancelledReason, hostContext } = useToolView();

  if (connectionError) {
    return (
      <Card>
        <p role="alert">The view could not connect to the agent: {connectionError.message}</p>
      </Card>
    );
  }
  if (cancelledReason) {
    return (
      <Card>
        <p className="fb-muted">The request was cancelled before the creative loaded.</p>
      </Card>
    );
  }
  if (!isConnected || !result) {
    return <Loading label="Loading the creative…" />;
  }

  const error = readFailure(result);
  if (error) {
    return (
      <Card>
        <h1 className="fb-title">The creative could not be loaded</h1>
        <p className="cp-error" role="alert">
          {error}
        </p>
      </Card>
    );
  }

  const preview = readCreativePreview(result);
  if (!preview) {
    return (
      <Card>
        <h1 className="fb-title">Creative preview</h1>
        <p className="fb-muted">{getResultText(result) ?? "There is no creative to show."}</p>
      </Card>
    );
  }

  // Keyed by id and version, so a creative that changed (or another one) starts from fresh view state.
  return (
    <Preview
      key={`${preview.creative.id}:${preview.creative.updatedAt}`}
      app={app}
      preview={preview}
      format={{ locale: hostContext?.locale, timeZone: hostContext?.timeZone }}
      hostTheme={hostContext?.theme === "dark" ? "dark" : "light"}
    />
  );
};
