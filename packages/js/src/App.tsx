import { h, VNode } from "preact";
import { useState } from "preact/hooks";
import Modal from "./components/Modal";
import SurveyView from "./components/SurveyView";
import type { JsConfig, Survey } from "@formbricks/types/js";

interface AppProps {
  config: JsConfig;
  survey: Survey;
  closeSurvey: () => Promise<void>;
}

export default function App({ config, survey, closeSurvey }: AppProps): VNode {
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
        <SurveyView config={config} survey={survey} close={close} brandColor={config.settings?.brandColor} />
      </Modal>
    </div>
  );
}
