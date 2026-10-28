import { useId, useMemo, useState } from "react";
import { getResultText } from "../../shared/tool-result";
import { Badge, Loading } from "../../shared/ui";
import { useToolView } from "../../shared/use-tool-view";
import { Callout } from "./Callout";
import { ReviewTab } from "./ReviewTab";
import { SurveyTabs, type TabId, panelId, tabId } from "./SurveyTabs";
import { TryTab } from "./TryTab";
import { createFormatters } from "./formatters";
import { getEnabledLanguages } from "./i18n-text";
import { getStatusLabel, getStatusTone, getTypeName } from "./outline";
import { parseShowSurveyResult } from "./read-result";
import { pickInitialLanguage } from "./renderer-config";
import "./survey-preview.css";
import type { ShowSurveyData } from "./types";

const SurveyPreview = ({
  data,
  input,
  toolView,
}: Readonly<{
  data: ShowSurveyData;
  input: Record<string, unknown> | null;
  toolView: ReturnType<typeof useToolView>;
}>) => {
  const { app, hostContext } = toolView;
  const { survey, meta } = data;
  const enabledLanguages = useMemo(() => getEnabledLanguages(survey.languages), [survey.languages]);
  const [languageCode, setLanguageCode] = useState(() =>
    pickInitialLanguage(input?.lang, survey.languages, survey.defaultLanguage)
  );
  const [tab, setTab] = useState<TabId>("review");
  // The renderer is only loaded once the person asks for it, and then kept mounted so their progress
  // survives a look at the Review tab.
  const [hasOpenedTry, setHasOpenedTry] = useState(false);
  const languageId = useId();

  const selectTab = (id: TabId) => {
    setTab(id);
    if (id === "try") setHasOpenedTry(true);
  };

  const formatters = useMemo(
    () => createFormatters({ locale: hostContext?.locale, timeZone: hostContext?.timeZone }),
    [hostContext?.locale, hostContext?.timeZone]
  );
  const capabilities = app?.getHostCapabilities();
  const problems = [...(meta?.problems ?? []), ...data.warnings];

  return (
    <div className="fb-stack">
      <header className="sp-header">
        <div className="sp-title-row">
          <h1 className="sp-title">{survey.name || "Untitled survey"}</h1>
          <div className="fb-row">
            <Badge tone={getStatusTone(survey.status)}>{getStatusLabel(survey.status)}</Badge>
            <Badge>{getTypeName(survey.type)}</Badge>
          </div>
        </div>
        {enabledLanguages.length > 1 ? (
          <div className="fb-row">
            <label className="sp-field-label" htmlFor={languageId}>
              Language
            </label>
            <select
              id={languageId}
              className="sp-select"
              value={languageCode}
              onChange={(event) => setLanguageCode(event.target.value)}>
              {enabledLanguages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.code}
                  {language.default ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </header>

      {problems.map((problem) => (
        <Callout key={problem} tone="warning">
          {problem}
        </Callout>
      ))}

      <div>
        <SurveyTabs active={tab} onChange={selectTab} />
        <div
          id={panelId("review")}
          role="tabpanel"
          aria-labelledby={tabId("review")}
          hidden={tab !== "review"}
          className="sp-panel">
          <ReviewTab
            data={data}
            languageCode={languageCode}
            formatters={formatters}
            app={app}
            canMessage={Boolean(capabilities?.message)}
            canOpenLinks={Boolean(capabilities?.openLinks)}
          />
        </div>
        <div
          id={panelId("try")}
          role="tabpanel"
          aria-labelledby={tabId("try")}
          hidden={tab !== "try"}
          className="sp-panel">
          {hasOpenedTry ? (
            <TryTab
              meta={meta}
              languageCode={languageCode}
              surveyLanguages={survey.languages}
              theme={hostContext?.theme === "dark" ? "dark" : "light"}
              app={app}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const App = () => {
  const toolView = useToolView();
  const { isConnected, connectionError, result, cancelledReason, input } = toolView;

  const parsed = useMemo(() => (result ? parseShowSurveyResult(result) : null), [result]);

  if (connectionError) {
    return (
      <Callout tone="danger">This view could not connect to the chat: {connectionError.message}</Callout>
    );
  }
  if (cancelledReason) {
    return <Callout>The request was cancelled before the survey arrived.</Callout>;
  }
  if (!isConnected || !result || !parsed) {
    return <Loading label="Loading the survey…" />;
  }
  if (parsed.kind === "error") {
    return <Callout tone="danger">The survey could not be shown: {parsed.message}</Callout>;
  }
  if (parsed.kind === "unreadable") {
    return (
      <Callout tone="warning">{getResultText(result) ?? "This result does not contain a survey."}</Callout>
    );
  }
  return <SurveyPreview data={parsed.data} input={input} toolView={toolView} />;
};
