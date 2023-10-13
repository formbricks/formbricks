import { useState } from "preact/hooks";
import { SurveyModalProps } from "../types/props";
import Modal from "./Modal";
import { Survey } from "./Survey";
import { ResponseErrorComponent } from "./ResponseErrorComponent";

export function SurveyModal({
  survey,
  brandColor,
  formbricksSignature,
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
  getHasFailedResponses = () => false,
  getResponseAccumulator,
}: SurveyModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [showResponseErrorComponent, setShowResponseErrorComponent] = useState(false);

  const responseAccumulator = getResponseAccumulator?.();

  const ErrorComponent = responseAccumulator ? (
    <ResponseErrorComponent
      responses={responseAccumulator.data}
      questions={survey.questions}
      brandColor={brandColor}
      supportEmail={survey.supportEmail}
    />
  ) : undefined;

  const close = () => {
    setIsOpen(false);
    setTimeout(() => {
      const hasFailedResponses = getHasFailedResponses();
      if (hasFailedResponses && !showResponseErrorComponent) {
        setShowResponseErrorComponent(true);
        setIsOpen(true);
      } else {
        onClose();
      }
    }, 1000); // wait for animation to finish}
  };

  return (
    <div id="fbjs">
      <Modal
        placement={placement}
        clickOutside={clickOutside}
        darkOverlay={darkOverlay}
        highlightBorderColor={highlightBorderColor}
        isOpen={isOpen}
        onClose={close}>
        <Survey
          survey={survey}
          brandColor={brandColor}
          formbricksSignature={formbricksSignature}
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
            }, 3000); // close modal automatically after 3 seconds
          }}
          isRedirectDisabled={isRedirectDisabled}
          showErrorComponent={showResponseErrorComponent}
          errorComponent={ErrorComponent}
        />
      </Modal>
    </div>
  );
}
