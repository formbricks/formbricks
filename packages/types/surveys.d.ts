import { SurveyContainerProps, SurveyInlineProps, SurveyModalProps } from "./formbricks-surveys";

declare global {
  interface Window {
    formbricksSurveys: {
      renderSurveyInline: (props: SurveyInlineProps) => void;
      renderSurveyModal: (props: SurveyModalProps) => void;
      renderSurvey: (props: SurveyContainerProps) => void;
    };
  }
}
