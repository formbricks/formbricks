import { h, render } from "preact";
import { SurveyContainerProps } from "@formbricks/types/formbricks-surveys";
import { RenderSurvey } from "@/components/general/render-survey";
import { I18nProvider } from "@/components/i18n/provider";
import { FILE_PICK_EVENT } from "@/lib/constants";
import { getI18nLanguage } from "@/lib/i18n-utils";
import { addCustomThemeToDom, addStylesToDom, setStyleNonce } from "@/lib/styles";

// Polyfill for webkit messageHandlers to prevent errors in browsers that don't fully support it
// (e.g., Instagram's iOS in-app browser). This prevents TypeError when accessing unregistered handlers.
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- WebKit types are not standard
  const win = window as any;

  // Create a Proxy that safely handles access to potentially undefined message handlers
  const createMessageHandlersProxy = (originalHandlers: any = {}) => {
    return new Proxy(originalHandlers, {
      get(target, prop) {
        const handler = target[prop as keyof typeof target];

        // If the handler doesn't exist, return a safe mock object with a no-op postMessage
        if (!handler) {
          return {
            postMessage: () => {
              // Silently ignore - the message handler is not registered in this environment
              console.debug(`WebKit message handler "${String(prop)}" is not available in this environment`);
            },
          };
        }

        return handler;
      },
    });
  };

  // Handle three scenarios:
  // 1. window.webkit doesn't exist at all (Instagram iOS browser)
  // 2. window.webkit exists but messageHandlers doesn't
  // 3. Both exist but handlers might be missing
  if (!win.webkit) {
    // Scenario 1: Create the entire webkit object with proxied messageHandlers
    win.webkit = {
      messageHandlers: createMessageHandlersProxy(),
    };
  } else if (!win.webkit.messageHandlers) {
    // Scenario 2: webkit exists but messageHandlers doesn't
    win.webkit.messageHandlers = createMessageHandlersProxy();
  } else {
    // Scenario 3: Both exist, wrap existing messageHandlers with proxy
    const originalMessageHandlers = win.webkit.messageHandlers;
    win.webkit.messageHandlers = createMessageHandlersProxy(originalMessageHandlers);
  }
}

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

  const { mode, containerId, languageCode } = props;

  addStylesToDom();
  addCustomThemeToDom({ styling: props.styling });

  const language = getI18nLanguage(languageCode, props.survey.languages);

  if (mode === "inline") {
    if (!containerId) {
      throw new Error("renderSurvey: containerId is required for inline mode");
    }

    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`renderSurvey: Element with id ${containerId} not found.`);
    }

    // if survey type is link, we don't pass the placement, overlay, clickOutside, onClose
    if (props.survey.type === "link") {
      const { placement, overlay, onClose, clickOutside, ...surveyInlineProps } = props;

      render(
        h(
          I18nProvider,
          { language },
          h(RenderSurvey, {
            ...surveyInlineProps,
          })
        ),
        element
      );
    } else {
      // For non-link surveys, pass placement through so it can be used in StackedCard
      const { overlay, onClose, clickOutside, ...surveyInlineProps } = props;

      render(
        h(
          I18nProvider,
          { language },
          h(RenderSurvey, {
            ...surveyInlineProps,
          })
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
        })
      ),
      modalContainer
    );
  }
};

export const renderSurveyModal = renderSurvey;

export const onFilePick = (files: { name: string; type: string; base64: string }[]) => {
  const fileUploadEvent = new CustomEvent(FILE_PICK_EVENT, { detail: files });
  globalThis.dispatchEvent(fileUploadEvent);
};

// Initialize the global formbricksSurveys object if it doesn't exist
if (globalThis.window !== undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Type definition is in @formbricks/types package
  (globalThis.window as any).formbricksSurveys = {
    renderSurveyInline,
    renderSurveyModal,
    renderSurvey,
    onFilePick,
    setNonce: setStyleNonce,
  } as typeof globalThis.window.formbricksSurveys;
}
