import { useState } from "preact/hooks";
import { SurveyModalProps } from "../../types/props";
import Modal from "../wrappers/Modal";
import { Survey } from "./Survey";

export function SurveyModal({
  survey,
  isBrandingEnabled,
  activeQuestionId,
  placement,
  clickOutside,
  darkOverlay,
  highlightBorderColor,
  onDisplay = () => {},
  onActiveQuestionChange = () => {},
  onResponse = () => {},
  onClose = () => {},
  onFinished = () => {},
  isRedirectDisabled = false,
}: SurveyModalProps) {
  const [isOpen, setIsOpen] = useState(true);

  const close = () => {
    setIsOpen(false);
    setTimeout(() => {
      onClose();
    }, 1000); // wait for animation to finish}
  };

  return (
    <div id="fbjs" className="formbricks-form">
      <Modal
        placement={placement}
        clickOutside={clickOutside}
        darkOverlay={darkOverlay}
        highlightBorderColor={highlightBorderColor}
        isOpen={isOpen}
        onClose={close}>
        <Survey
          survey={survey}
          isBrandingEnabled={isBrandingEnabled}
          activeQuestionId={activeQuestionId}
          onDisplay={onDisplay}
          onActiveQuestionChange={onActiveQuestionChange}
          onResponse={onResponse}
          onClose={onClose}
          onFinished={() => {
            onFinished();
            setTimeout(() => {
              if (!survey.redirectUrl) {
                close();
              }
            }, 4000); // close modal automatically after 4 seconds
          }}
          isRedirectDisabled={isRedirectDisabled}
        />
      </Modal>
    </div>
  );
}
