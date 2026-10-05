import { SurveyContainerProps, TSurveyAppearance } from "./formbricks-surveys";

declare global {
  interface Window {
    formbricksSurveys: {
      renderSurveyInline: (props: SurveyContainerProps) => void;
      renderSurveyModal: (props: SurveyContainerProps) => void;
      renderSurvey: (props: SurveyContainerProps) => void;
      onFilePick: (files: { name: string; type: string; base64: string }[]) => void;
      setNonce: (nonce: string | undefined) => void;
      setAppearance: (appearance: TSurveyAppearance) => void;
    };
    __formbricksNonce?: string;
  }
}
