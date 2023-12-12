import { useState } from "preact/hooks";
import { SurveyInlineProps } from "@/types/props";
import { Survey } from "./Survey";
import { ResponseErrorComponent } from "./ResponseErrorComponent";

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
  getHasFailedResponses,
  getResponseAccumulator,
}: SurveyInlineProps) {
  const [showResponseErrorComponent, setShowResponseErrorComponent] = useState(false);

  const responseAccumulator = getResponseAccumulator?.();
  const ErrorComponent = responseAccumulator ? (
    <ResponseErrorComponent
      responses={responseAccumulator.data}
      questions={survey.questions}
      supportEmail={survey.supportEmail}
    />
  ) : undefined;

  const onFinished = () => {
    const hasFailedResponses = getHasFailedResponses?.();
    setTimeout(() => {
      setShowResponseErrorComponent(hasFailedResponses ?? false);
    }, 3000);
  };
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
        onFinished={onFinished}
        prefillResponseData={prefillResponseData}
        isRedirectDisabled={isRedirectDisabled}
        showErrorComponent={showResponseErrorComponent}
        errorComponent={ErrorComponent}
        onFileUpload={onFileUpload}
        responseCount={responseCount}
      />
    </div>
  );
}
