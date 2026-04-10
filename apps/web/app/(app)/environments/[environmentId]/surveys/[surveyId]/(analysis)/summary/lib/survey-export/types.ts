export interface ExportableSurvey {
  name: string;
  createdAt: Date;
  status: string;
  type: string;
  welcomeCard?: {
    headline?: string;
    subheader?: string;
    buttonLabel?: string;
  };
  sections: ExportableSection[];
  endings: ExportableEnding[];
  hiddenFields: string[];
  variables: { name: string; type: string; value: string | number }[];
}

export interface ExportableSection {
  name: string;
  questions: ExportableQuestion[];
  logic?: ExportableLogicRule[];
  buttonLabel?: string;
  backButtonLabel?: string;
}

export interface ExportableQuestion {
  index: number;
  id: string;
  type: string;
  headline: string;
  subheader?: string;
  required: boolean;
  details: ExportableQuestionDetail[];
  logic?: ExportableLogicRule[];
}

export interface ExportableQuestionDetail {
  label: string;
  value: string;
  items?: string[];
}

export interface ExportableLogicRule {
  summary: string;
}

export interface ExportableEnding {
  type: "endScreen" | "redirectToUrl";
  headline?: string;
  subheader?: string;
  buttonLabel?: string;
  redirectUrl?: string;
}
