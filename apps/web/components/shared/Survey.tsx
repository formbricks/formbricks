import { renderSurveyInline, renderSurveyModal } from "@formbricks/surveys";
import { Survey } from "@formbricks/types/surveys";
import { TResponse } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";
import { useEffect, useMemo } from "react";

const createContainerId = () => `formbricks-survey-modal-${Math.random().toString(36).slice(2)}`;

interface SurveyProps {
  survey: TSurvey | Survey;
  brandColor: string;
  formbricksSignature: boolean;
  activeQuestionId?: string;
  onDisplay?: () => void;
  onResponse?: (response: Partial<TResponse>) => void;
  onActiveQuestionChange?: (questionId: string) => void;
  onClose?: () => void;
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
    });
  });
  return <div id={containerId}></div>;
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
    });
  });
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
  });
  return <div id={containerId}></div>;
};
