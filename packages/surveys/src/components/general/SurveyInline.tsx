import { SurveyBaseProps } from "@/types/props";

import { Survey } from "./Survey";

export function SurveyInline({
  survey,
  isBrandingEnabled,
  activeQuestionId,
  onDisplay = () => {},
  onActiveQuestionChange = () => {},
  onResponse = () => {},
  onClose = () => {},
  prefillResponseData,
  isRedirectDisabled = false,
  onFileUpload,
  responseCount,
}: SurveyBaseProps) {
  return (
    <div id="fbjs" className="formbricks-form h-full w-full">
      <Survey
        survey={survey}
        isBrandingEnabled={isBrandingEnabled}
        activeQuestionId={activeQuestionId}
        onDisplay={onDisplay}
        onActiveQuestionChange={onActiveQuestionChange}
        onResponse={onResponse}
        onClose={onClose}
        prefillResponseData={prefillResponseData}
        isRedirectDisabled={isRedirectDisabled}
        onFileUpload={onFileUpload}
        responseCount={responseCount}
      />
    </div>
  );
}
