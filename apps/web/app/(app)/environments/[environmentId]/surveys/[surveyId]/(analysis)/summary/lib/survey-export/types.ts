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
  elementType: string; // raw enum value for rendering decisions
  headline: string;
  subheader?: string;
  required: boolean;
  details: ExportableQuestionDetail[];
  logic?: ExportableLogicRule[];
  // Rich rendering data
  choices?: ExportableChoice[];
  matrix?: ExportableMatrix;
  ratingScale?: ExportableRatingScale;
  npsScale?: ExportableNpsScale;
  addressFields?: ExportableFieldConfig[];
  contactFields?: ExportableFieldConfig[];
  consentLabel?: string;
  inputConfig?: { type: string; longAnswer: boolean; placeholder?: string };
}

export interface ExportableChoice {
  label: string;
  isOther?: boolean;
}

export interface ExportableMatrix {
  rows: string[];
  columns: string[];
}

export interface ExportableRatingScale {
  style: "number" | "smiley" | "star";
  range: number;
  lowerLabel?: string;
  upperLabel?: string;
}

export interface ExportableNpsScale {
  lowerLabel?: string;
  upperLabel?: string;
}

export interface ExportableFieldConfig {
  name: string;
  required: boolean;
  placeholder?: string;
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
