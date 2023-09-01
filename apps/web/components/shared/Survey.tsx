import { renderSurveyInline, renderSurveyModal } from "@formbricks/surveys";
import { Survey } from "@formbricks/types/surveys";
import { TResponseUpdate } from "@formbricks/types/v1/responses";
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
  onActiveQuestionChange?: (questionId: string) => void;
  onClose?: () => void;
  autoFocus?: boolean;
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
  ]);
  return <div id="formbricks-survey"></div>;
};

export const SurveyModalInline = ({
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
}: SurveyModalProps) => {
  const containerId = useMemo(() => createContainerId(), []);
  useEffect(() => {
    renderSurveyModal({
      survey,
      brandColor,
      formbricksSignature,
      containerId,
      placement,
      clickOutside,
      darkOverlay,
      highlightBorderColor,
      onDisplay,
      onResponse,
      onClose,
      activeQuestionId,
      onActiveQuestionChange,
    });
  }, [
    activeQuestionId,
    brandColor,
    clickOutside,
    containerId,
    darkOverlay,
    formbricksSignature,
    highlightBorderColor,
    onActiveQuestionChange,
    onClose,
    onDisplay,
    onResponse,
    placement,
    survey,
  ]);
  return <div id={containerId}></div>;
};
