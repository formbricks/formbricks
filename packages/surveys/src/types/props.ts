import { TResponseData, TResponseUpdate } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

export interface SurveyBaseProps {
  survey: TSurvey;
  isBrandingEnabled: boolean;
  activeQuestionId?: string;
  onDisplay?: () => void;
  onResponse?: (response: TResponseUpdate) => void;
  onFinished?: () => void;
  onClose?: () => void;
  onActiveQuestionChange?: (questionId: string) => void;
  autoFocus?: boolean;
  isRedirectDisabled?: boolean;
  prefillResponseData?: TResponseData;
}

export interface SurveyInlineProps extends SurveyBaseProps {
  containerId: string;
}

export interface SurveyModalProps extends SurveyBaseProps {
  clickOutside: boolean;
  darkOverlay: boolean;
  highlightBorderColor: string | null;
  placement: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
}
