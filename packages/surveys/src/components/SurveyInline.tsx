import { SurveyBaseProps } from "../types/props";
import { Survey } from "./Survey";

export function SurveyInline({
  survey,
  brandColor,
  formbricksSignature,
  activeQuestionId,
  onDisplay = () => {},
  onActiveQuestionChange = () => {},
  onResponse = () => {},
  onClose = () => {},
  prefillResponseData,
  isRedirectDisabled = false,
  hasFailedResponses,
  responseAccumulator,
}: SurveyBaseProps) {
  return (
    <div id="fbjs" className="h-full w-full">
      <Survey
        survey={survey}
        brandColor={brandColor}
        formbricksSignature={formbricksSignature}
        activeQuestionId={activeQuestionId}
        onDisplay={onDisplay}
        onActiveQuestionChange={onActiveQuestionChange}
        onResponse={onResponse}
        onClose={onClose}
        prefillResponseData={prefillResponseData}
        isRedirectDisabled={isRedirectDisabled}
        hasFailedResponses={hasFailedResponses}
        responseAccumulator={responseAccumulator}
      />
    </div>
  );
}
