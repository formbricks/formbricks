import type { TJsConfig } from "../../types/v1/js";
import type { TSurvey } from "../../types/v1/surveys";
import { VNode, h } from "preact";
import { useState } from "preact/hooks";
import Modal from "./components/Modal";
import SurveyView from "./components/SurveyView";
import { IErrorHandler } from "./lib/errors";
import { clearStoredResponse } from "./lib/localStorage";

interface AppProps {
  config: TJsConfig;
  survey: TSurvey;
  closeSurvey: () => Promise<void>;
  errorHandler: IErrorHandler;
}

export default function App({ config, survey, closeSurvey, errorHandler }: AppProps): VNode {
  const [isOpen, setIsOpen] = useState(true);

  const close = () => {
    setIsOpen(false);
    clearStoredResponse(survey.id);
    setTimeout(() => {
      closeSurvey();
    }, 1000); // wait for animation to finish}
  };

  return (
    <div id="fbjs">
      <Modal
        isOpen={isOpen}
        close={close}
        placement={survey.placement ? survey.placement : config.state.product.placement}
        darkOverlay={survey.placement ? survey.darkOverlay : config.state.product.darkOverlay}
        highlightBorderColor={config.state.product.highlightBorderColor}
        clickOutside={survey.placement ? survey.clickOutsideClose : config.state.product.clickOutsideClose}>
        <SurveyView config={config} survey={survey} close={close} errorHandler={errorHandler} />
      </Modal>
    </div>
  );
}
