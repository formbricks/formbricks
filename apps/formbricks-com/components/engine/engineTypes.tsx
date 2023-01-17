export interface SurveyOption {
  label: string;
  value: string;
}

export interface SurveyPage {
  id: string;
  questions: SurveyQuestion[];
  config?: {
    autoSubmit: boolean;
  };
}

export interface SurveyQuestion {
  id: string;
  field: string;
  label: string;
  type: "radio" | "textarea";
  options: SurveyOption[];
  component: React.FC<any>;
}

export interface Survey {
  pages: SurveyPage[];
}
