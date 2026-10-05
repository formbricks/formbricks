import { type ComponentChild, type FunctionComponent, h, render } from "preact";
import { SurveyPortalContainerContext } from "@formbricks/survey-ui";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { RenderSurvey } from "@/components/general/render-survey";
import { I18nProvider } from "@/components/i18n/provider";
import { setAppearance } from "@/lib/appearance";
import { FILE_PICK_EVENT } from "@/lib/constants";
import { applyCustomCss, syncCustomCssNonce } from "@/lib/custom-css";
import { getI18nLanguage } from "@/lib/i18n-utils";
import { setLocaleBaseUrl } from "@/lib/i18n.config";
import { getPreviewPortalContainer } from "@/lib/preview-boundary";
import { addCustomThemeToDom, addStylesToDom, setStyleNonce } from "@/lib/styles";

// survey-ui is typed against React; in this bundle `react` resolves to preact/compat, so at runtime its
// context is a Preact one and its Provider renders like any Preact component.
const PortalContainerProvider = SurveyPortalContainerContext.Provider as unknown as FunctionComponent<{
  value: HTMLElement | null;
}>;

export const renderSurveyInline = (props: SurveyContainerProps) => {
  const inlineProps: SurveyContainerProps = {
    ...props,
    mode: "inline",
  };

  renderSurvey(inlineProps);
};

export const renderSurvey = (props: SurveyContainerProps) => {
  // render SurveyNew
  // if survey type is link, we don't pass the placement, overlay, clickOutside, onClose

  const { mode, containerId, languageCode, appUrl } = props;

  // Where the on-demand locale bundles live, beside the renderer itself.
  setLocaleBaseUrl(appUrl);

  // Before the first render, so the survey never paints in the wrong appearance.
  setAppearance(props.appearance);
  addStylesToDom();
  addCustomThemeToDom({ styling: props.styling });
  // Only from the explicit prop (ENG-3552): CSS on `props.survey` or `props.styling` is never read.
  // Before the render, so the first paint already has it; replaces whatever an earlier survey applied.
  applyCustomCss(props.customCss);

  const language = getI18nLanguage(languageCode, props.survey.languages);

  // SDK clients may request a legacy code (e.g. "hi") that is no longer a survey content key after
  // canonicalization (content is keyed "hi-IN"). Render the survey under the resolved canonical code so
  // content lookups — and recall parsing, which indexes content directly — don't hit `undefined`. The
  // "default" sentinel is preserved (content stores its value under the "default" key).
  const surveyLanguageCode = languageCode === "default" ? languageCode : language;

  if (mode === "inline") {
    if (!containerId) {
      throw new Error("renderSurvey: containerId is required for inline mode");
    }

    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`renderSurvey: Element with id ${containerId} not found.`);
    }

    // In a dashboard preview, dropdown menus mount inside the preview's contained box instead of
    // <body>, so customer CSS (which reaches every #fbjs root) cannot lay them over the admin app.
    // Respondent surfaces have no boundary, so their menus keep mounting in <body>.
    const portalContainer = props.isPreviewMode ? getPreviewPortalContainer(element) : null;
    const withPortalContainer = (child: ComponentChild) =>
      h(PortalContainerProvider, { value: portalContainer }, child);

    // if survey type is link, we don't pass the placement, overlay, clickOutside, onClose
    if (props.survey.type === "link") {
      const { placement, overlay, onClose, clickOutside, ...surveyInlineProps } = props;

      render(
        withPortalContainer(
          h(
            I18nProvider,
            { language },
            h(RenderSurvey, {
              ...surveyInlineProps,
              languageCode: surveyLanguageCode,
            })
          )
        ),
        element
      );
    } else {
      // For non-link surveys, pass placement through so it can be used in StackedCard
      const { overlay, onClose, clickOutside, ...surveyInlineProps } = props;

      render(
        withPortalContainer(
          h(
            I18nProvider,
            { language },
            h(RenderSurvey, {
              ...surveyInlineProps,
              languageCode: surveyLanguageCode,
            })
          )
        ),
        element
      );
    }
  } else {
    const modalContainer = document.createElement("div");
    modalContainer.id = "formbricks-modal-container";
    document.body.appendChild(modalContainer);

    render(
      h(
        I18nProvider,
        { language },
        h(RenderSurvey, {
          ...props,
          languageCode: surveyLanguageCode,
        })
      ),
      modalContainer
    );
  }
};

export const renderSurveyModal = renderSurvey;

/**
 * Sets the CSP nonce for every style element the renderer owns, including the custom CSS ones, which
 * are re-applied so a stylesheet the browser refused without the nonce gets it now.
 */
export const setNonce = (nonce: string | undefined): void => {
  setStyleNonce(nonce);
  syncCustomCssNonce();
};

export const onFilePick = (files: { name: string; type: string; base64: string }[]) => {
  const fileUploadEvent = new CustomEvent(FILE_PICK_EVENT, { detail: files });
  globalThis.dispatchEvent(fileUploadEvent);
};

// Initialize the global formbricksSurveys object if it doesn't exist
if (globalThis.window !== undefined) {
  (globalThis.window as any).formbricksSurveys = {
    renderSurveyInline,
    renderSurveyModal,
    renderSurvey,
    onFilePick,
    setNonce,
    setAppearance,
  } as typeof globalThis.window.formbricksSurveys;
}
