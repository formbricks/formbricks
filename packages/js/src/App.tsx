import { h, VNode } from "preact";
import { useState } from "preact/hooks";
import Modal from "./components/Modal";
import SurveyView from "./components/SurveyView";
import type { Config, Survey } from "./types/types";

interface AppProps {
  config: Config;
  survey: Survey;
  closeSurvey: () => void;
  brandColor: string;
}

export default function App({ config, survey, closeSurvey, brandColor }: AppProps): VNode {
  const [isOpen, setIsOpen] = useState(true);

  const close = () => {
    setIsOpen(false);
    setTimeout(() => {
      closeSurvey();
    }, 1000); // wait for animation to finish}
  };

  return (
    <div className="tailwind-preflight">
      <Modal isOpen={isOpen} close={close}>
        <SurveyView config={config} survey={survey} close={close} brandColor={brandColor} />
      </Modal>
    </div>
  );
}
