import { Modal } from "@/components/wrappers/Modal";
import { useState } from "preact/hooks";
import { SurveyModalProps } from "@formbricks/types/formbricks-surveys";
import { Survey } from "./Survey";

export const SurveyModal = ({
  survey,
  isBrandingEnabled,
  getSetIsError,
  placement,
  clickOutside,
  darkOverlay,
  onDisplay,
  getSetIsResponseSendingFinished,
  onResponse,
  onClose,
  onFinished = () => {},
  onFileUpload,
  onRetry,
  isRedirectDisabled = false,
  languageCode,
  responseCount,
  styling,
  hiddenFieldsRecord,
}: SurveyModalProps) => {
  const [isOpen, setIsOpen] = useState(true);

  const close = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 1000); // wait for animation to finish}
  };

  const highlightBorderColor = styling?.highlightBorderColor?.light || null;

  return (
    <div id="fbjs" className="fb-formbricks-form">
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
          onDisplay={onDisplay}
          getSetIsResponseSendingFinished={getSetIsResponseSendingFinished}
          onResponse={onResponse}
          languageCode={languageCode}
          onClose={close}
          onFinished={() => {
            onFinished();
            setTimeout(
              () => {
                const firstEnabledEnding = survey.endings[0];
                if (firstEnabledEnding?.type !== "redirectToUrl") {
                  close();
                }
              },
              survey.endings.length ? 3000 : 0 // close modal automatically after 3 seconds if no ending is enabled; otherwise, close immediately
            );
          }}
          onRetry={onRetry}
          getSetIsError={getSetIsError}
          onFileUpload={onFileUpload}
          isRedirectDisabled={isRedirectDisabled}
          responseCount={responseCount}
          styling={styling}
          isCardBorderVisible={!highlightBorderColor}
          clickOutside={placement === "center" ? clickOutside : undefined}
          hiddenFieldsRecord={hiddenFieldsRecord}
        />
      </Modal>
    </div>
  );
};
