import { useEffect, useMemo } from "react";

import { renderSurveyInline, renderSurveyModal } from "@formbricks/surveys";
import { TResponseData, TResponseUpdate } from "@formbricks/types/responses";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { TSurvey } from "@formbricks/types/surveys";

const createContainerId = () => `formbricks-survey-container`;

interface SurveyProps {
  survey: TSurvey;
  brandColor: string;
  isBrandingEnabled: boolean;
  activeQuestionId?: string;
  getSetIsError?: (getSetError: (value: boolean) => void) => void;
  onRetry?: () => void;
  onDisplay?: () => void;
  onResponse?: (response: TResponseUpdate) => void;
  onFinished?: () => void;
  onActiveQuestionChange?: (questionId: string) => void;
  onClose?: () => void;
  onFileUpload: (file: File, config?: TUploadFileConfig) => Promise<string>;
  autoFocus?: boolean;
  prefillResponseData?: TResponseData;
  isRedirectDisabled?: boolean;
  responseCount?: number;
  supportEmail?: string | null;
}

interface SurveyModalProps extends SurveyProps {
  placement: "topRight" | "bottomRight" | "bottomLeft" | "topLeft" | "center";
  clickOutside: boolean;
  darkOverlay: boolean;
  highlightBorderColor: string | null;
}

export const SurveyInline = (props: SurveyProps) => {
  const containerId = useMemo(() => createContainerId(), []);
  useEffect(() => {
    renderSurveyInline({
      ...props,
      containerId,
    });
  }, [containerId, props]);
  return <div id={containerId} className="h-full w-full" />;
};

export const SurveyModal = (props: SurveyModalProps) => {
  useEffect(() => {
    renderSurveyModal(props);
  }, [props]);
  return <div id="formbricks-survey"></div>;
};
