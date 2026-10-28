import type { App } from "@modelcontextprotocol/ext-apps";
import { useEffect, useId, useMemo, useState } from "react";
import { Button, Loading } from "../../shared/ui";
import { Callout } from "./Callout";
import { getStageBackground } from "./background";
import { loadRenderer } from "./renderer";
import { isHttpUrl, toRendererLanguage, toScriptUrl } from "./renderer-config";
import type { PreviewMeta, SurveyLanguage } from "./types";

interface TryTabProps {
  meta: PreviewMeta | null;
  languageCode: string;
  surveyLanguages: SurveyLanguage[];
  theme: "light" | "dark";
  app: App | null;
}

type Status = "loading" | "ready" | "unavailable";

/** What the renderer load came to, for the container it was started for. */
interface Outcome {
  containerId: string;
  status: Exclude<Status, "loading">;
  reason: string;
}

/** The attribute the renderer looks for to keep dropdown menus inside the preview's contained box. */
const PREVIEW_BOUNDARY_ATTRIBUTE = "data-fb-preview-boundary";

/**
 * The real respondent renderer, preview-only: `isPreviewMode` makes it skip the display and the response,
 * and no workspace id is passed, so there is no API client that could send anything even if a code path
 * forgot the flag. Its script comes from the deployment the server named and is the file SDK customers
 * load.
 */
export const TryTab = ({ meta, languageCode, surveyLanguages, theme, app }: Readonly<TryTabProps>) => {
  const [restarts, setRestarts] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const idPrefix = useId().replace(/[^a-zA-Z0-9]/g, "");

  const rendererLanguage = useMemo(
    () =>
      meta ? toRendererLanguage(languageCode, surveyLanguages, meta.render.survey.languages) : "default",
    [meta, languageCode, surveyLanguages]
  );
  // Dark applies to app surveys only: a link survey has no dark palette and always renders light.
  const appearance = meta?.render.survey.type === "app" && theme === "dark" ? "dark" : "light";
  const containerId = `fb-preview-${idPrefix}-${restarts}-${rendererLanguage}-${appearance}`;

  const scriptUrl = meta ? toScriptUrl(meta.rendererUrl, document.baseURI) : null;

  useEffect(() => {
    if (!meta || !scriptUrl) return;
    let cancelled = false;

    loadRenderer(scriptUrl)
      .then((surveys) => {
        if (cancelled) return;
        surveys.renderSurveyInline({
          survey: meta.render.survey,
          styling: meta.render.styling,
          isBrandingEnabled: meta.render.isBrandingEnabled,
          customCss: meta.render.customCss,
          languageCode: rendererLanguage,
          appUrl: meta.appUrl,
          isPreviewMode: true,
          autoFocus: false,
          shouldResetQuestionId: false,
          appearance,
          containerId,
          onClose: () => setRestarts((count) => count + 1),
          onOpenExternalURL: (url: string) => {
            if (isHttpUrl(url)) void app?.openLink({ url });
          },
        });
        setOutcome({ containerId, status: "ready", reason: "" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setOutcome({
          containerId,
          status: "unavailable",
          reason: error instanceof Error ? error.message : "unknown error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [meta, scriptUrl, rendererLanguage, appearance, containerId, app]);

  // A new container (restart, language, theme) has no outcome yet, so it reads as loading until its own
  // load settles.
  let status: Status = outcome?.containerId === containerId ? outcome.status : "loading";
  let reason = outcome?.containerId === containerId ? outcome.reason : "";
  if (meta && !scriptUrl) {
    status = "unavailable";
    reason = "The survey renderer address is not valid.";
  }

  if (!meta) {
    return (
      <Callout>
        The preview needs data this result does not carry. The Review tab shows the whole survey; ask the
        agent to show the survey again to try it.
      </Callout>
    );
  }

  return (
    <div>
      <div className="sp-try-bar">
        <span className="fb-faint">Preview only: nothing you enter here is saved.</span>
        <Button onClick={() => setRestarts((count) => count + 1)} disabled={status !== "ready"}>
          Restart
        </Button>
      </div>
      {status === "unavailable" ? (
        <Callout tone="warning">
          The survey could not be loaded for trying out ({reason}). The agent&apos;s host may be blocking
          scripts from this Formbricks instance. The Review tab still shows the whole survey.
        </Callout>
      ) : (
        <div
          className="sp-stage"
          data-appearance={appearance}
          {...{ [PREVIEW_BOUNDARY_ATTRIBUTE]: "" }}
          style={{
            background:
              meta.render.survey.type === "link" ? getStageBackground(meta.render.styling) : undefined,
          }}>
          {status === "loading" ? (
            <div className="sp-center">
              <Loading label="Loading the survey…" />
            </div>
          ) : null}
          <div key={containerId} id={containerId} className="sp-stage-inner" />
        </div>
      )}
    </div>
  );
};
