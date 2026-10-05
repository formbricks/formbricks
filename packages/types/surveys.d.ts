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
      /** Removes the custom CSS stylesheet. Optional: renderer bundles older than custom CSS lack it. */
      removeCustomCss?: () => void;
    };
    __formbricksNonce?: string;
  }
}
