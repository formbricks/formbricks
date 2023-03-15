import { h, VNode } from "preact";
import { useEffect, useState } from "preact/compat";
import Modal from "./components/Modal";
import SurveyView from "./components/SurveyView";
import type { Config, Survey } from "./types/types";

interface AppProps {
  config: Config;
  survey: Survey;
  closeSurvey: () => void;
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
    <div className="tailwind-preflight">
      <Modal isOpen={isOpen}>
        <SurveyView config={config} survey={survey} close={close} />
      </Modal>
    </div>
  );
}
