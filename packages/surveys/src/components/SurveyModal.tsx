import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { Survey } from "./Survey";
import Modal from "./Modal";

interface SurveyModalProps {
  survey: TSurvey;
  brandColor: string;
  formbricksSignature: boolean;
  activeQuestionId?: string;
  placement: "topRight" | "bottomRight" | "bottomLeft" | "topLeft" | "center";
  clickOutside: boolean;
  darkOverlay: boolean;
  highlightBorderColor: string | null;
  onDisplay?: () => void;
  onActiveQuestionChange?: (questionId: string) => void;
  onResponse?: (response: Partial<TResponse>) => void;
  onClose?: () => void;
}

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
}: SurveyModalProps) {
  return (
    <div id="fbjs">
      <Modal
        placement={placement}
        clickOutside={clickOutside}
        darkOverlay={darkOverlay}
        highlightBorderColor={highlightBorderColor}
        isOpen={false}
        onClose={onClose}>
        <Survey
          survey={survey}
          brandColor={brandColor}
          formbricksSignature={formbricksSignature}
          activeQuestionId={activeQuestionId}
          onDisplay={onDisplay}
          onActiveQuestionChange={onActiveQuestionChange}
          onResponse={onResponse}
          onClose={onClose}
        />
      </Modal>
    </div>
  );
}
