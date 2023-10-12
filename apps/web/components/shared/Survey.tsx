import { renderSurveyInline, renderSurveyModal } from "@formbricks/surveys";
import { Survey } from "@formbricks/types/surveys";
import { TResponseData, TResponseUpdate } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { useEffect, useMemo } from "react";

const createContainerId = () => `formbricks-survey-container`;

interface SurveyProps {
  survey: TSurvey | Survey;
  brandColor: string;
  formbricksSignature: boolean;
  activeQuestionId?: string;
  onDisplay?: () => void;
  onResponse?: (response: TResponseUpdate) => void;
  onFinished?: () => void;
  onActiveQuestionChange?: (questionId: string) => void;
  onClose?: () => void;
  autoFocus?: boolean;
  prefillResponseData?: TResponseData;
  isRedirectDisabled?: boolean;
  hasFailedResponses: boolean;
  responseAccumulator: TResponseUpdate;
}

interface SurveyModalProps extends SurveyProps {
  placement?: "topRight" | "bottomRight" | "bottomLeft" | "topLeft" | "center";
  clickOutside?: boolean;
  darkOverlay?: boolean;
  highlightBorderColor?: string | null;
}

export const SurveyInline = ({
  survey,
  brandColor,
  formbricksSignature,
  activeQuestionId,
  onDisplay = () => {},
  onResponse = () => {},
  onActiveQuestionChange = () => {},
  onClose = () => {},
  autoFocus,
  prefillResponseData,
  isRedirectDisabled,
  hasFailedResponses,
  responseAccumulator,
}: SurveyProps) => {
  const containerId = useMemo(() => createContainerId(), []);
  useEffect(() => {
    renderSurveyInline({
      survey,
      brandColor,
      formbricksSignature,
      containerId,
      onDisplay,
      onResponse,
      onClose,
      activeQuestionId,
      onActiveQuestionChange,
      autoFocus,
      prefillResponseData,
      isRedirectDisabled,
      hasFailedResponses,
    });
  }, [
    activeQuestionId,
    brandColor,
    containerId,
    formbricksSignature,
    onActiveQuestionChange,
    onClose,
    onDisplay,
    onResponse,
    survey,
    autoFocus,
    prefillResponseData,
    isRedirectDisabled,
    hasFailedResponses,
    responseAccumulator,
  ]);
  return <div id={containerId} className="h-full w-full" />;
};

export const SurveyModal = ({
  survey,
  brandColor,
  formbricksSignature,
  activeQuestionId,
  placement = "bottomRight",
  clickOutside = false,
  darkOverlay = false,
  highlightBorderColor = null,
  onDisplay = () => {},
  onResponse = () => {},
  onActiveQuestionChange = () => {},
  onClose = () => {},
  autoFocus,
  isRedirectDisabled,
  hasFailedResponses,
  responseAccumulator,
}: SurveyModalProps) => {
  useEffect(() => {
    renderSurveyModal({
      survey,
      brandColor,
      formbricksSignature,
      placement,
      clickOutside,
      darkOverlay,
      highlightBorderColor,
      onDisplay,
      onResponse,
      onClose,
      activeQuestionId,
      onActiveQuestionChange,
      autoFocus,
      isRedirectDisabled,
      hasFailedResponses,
      responseAccumulator,
    });
  }, [
    activeQuestionId,
    brandColor,
    clickOutside,
    darkOverlay,
    formbricksSignature,
    highlightBorderColor,
    onActiveQuestionChange,
    onClose,
    onDisplay,
    onResponse,
    placement,
    survey,
    autoFocus,
    isRedirectDisabled,
    hasFailedResponses,
    responseAccumulator,
  ]);
  return <div id="formbricks-survey"></div>;
};
