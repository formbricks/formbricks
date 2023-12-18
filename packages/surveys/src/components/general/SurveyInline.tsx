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
  onFinished = () => {},
  prefillResponseData,
  isRedirectDisabled = false,
  onFileUpload,
  responseCount,
  isMobileApp
}: SurveyBaseProps) {
  return (
    <div id="fbjs" className="formbricks-form h-full w-full">
      <Survey
        survey={survey}
        onFinished={onFinished}
        isBrandingEnabled={isBrandingEnabled}
        isMobileApp={isMobileApp}
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
