import { renderSurveyInline, renderSurveyModal } from "@formbricks/surveys";
import { TResponseData, TResponseUpdate } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";
import { useEffect, useMemo } from "react";

const createContainerId = () => `formbricks-survey-container`;

interface SurveyProps {
  survey: TSurvey;
  brandColor: string;
  isBrandingEnabled: boolean;
  activeQuestionId?: string;
  onDisplay?: () => void;
  onResponse?: (response: TResponseUpdate) => void;
  onFinished?: () => void;
  onActiveQuestionChange?: (questionId: string) => void;
  onClose?: () => void;
  autoFocus?: boolean;
  prefillResponseData?: TResponseData;
  isRedirectDisabled?: boolean;
  language: string;
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
  isBrandingEnabled,
  activeQuestionId,
  onDisplay = () => {},
  onResponse = () => {},
  onActiveQuestionChange = () => {},
  onClose = () => {},
  autoFocus,
  prefillResponseData,
  isRedirectDisabled,
  language,
}: SurveyProps) => {
  const containerId = useMemo(() => createContainerId(), []);
  useEffect(() => {
    renderSurveyInline({
      survey,
      brandColor,
      isBrandingEnabled,
      containerId,
      onDisplay,
      onResponse,
      onClose,
      activeQuestionId,
      onActiveQuestionChange,
      autoFocus,
      prefillResponseData,
      isRedirectDisabled,
      language,
    });
  }, [
    activeQuestionId,
    brandColor,
    containerId,
    isBrandingEnabled,
    onActiveQuestionChange,
    onClose,
    onDisplay,
    onResponse,
    survey,
    autoFocus,
    prefillResponseData,
    isRedirectDisabled,
  ]);
  return <div id={containerId} className="h-full w-full" />;
};

export const SurveyModal = ({
  survey,
  brandColor,
  isBrandingEnabled,
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
  language,
}: SurveyModalProps) => {
  useEffect(() => {
    renderSurveyModal({
      survey,
      brandColor,
      isBrandingEnabled,
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
      language,
    });
  }, [
    activeQuestionId,
    brandColor,
    clickOutside,
    darkOverlay,
    isBrandingEnabled,
    highlightBorderColor,
    onActiveQuestionChange,
    onClose,
    onDisplay,
    onResponse,
    placement,
    survey,
    autoFocus,
    isRedirectDisabled,
  ]);
  return <div id="formbricks-survey"></div>;
};
