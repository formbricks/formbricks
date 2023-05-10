import type { JsConfig, Survey } from "../../types/js";
import { VNode, h } from "preact";
import { useState } from "preact/hooks";
import Modal from "./components/Modal";
import SurveyView from "./components/SurveyView";
import { IErrorHandler } from "./lib/errors";

interface AppProps {
  config: JsConfig;
  survey: Survey;
  closeSurvey: () => Promise<void>;
  errorHandler: IErrorHandler;
}

export default function App({ config, survey, closeSurvey, errorHandler }: AppProps): VNode {
  const [isOpen, setIsOpen] = useState(true);

  const close = () => {
    setIsOpen(false);
    setTimeout(() => {
      closeSurvey();
    }, 1000); // wait for animation to finish}
  };

  return (
    <div id="fbjs">
      <Modal isOpen={isOpen} close={close}>
        <SurveyView
          config={config}
          survey={survey}
          close={close}
          brandColor={config.settings?.brandColor}
          errorHandler={errorHandler}
        />
      </Modal>
    </div>
  );
}
