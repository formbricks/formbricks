export type Question =
  | OpenTextQuestion
  | MultipleChoiceSingleQuestion
  | MultipleChoiceMultiQuestion
  | NPSQuestion;

export interface OpenTextQuestion {
  id: string;
  type: "openText";
  headline: string;
  subheader?: string;
  placeholder?: string;
  buttonLabel?: string;
  required: boolean;
}

export interface MultipleChoiceSingleQuestion {
  id: string;
  type: "multipleChoiceSingle";
  headline: string;
  subheader?: string;
  required: boolean;
  buttonLabel?: string;
  choices: Choice[];
}

export interface MultipleChoiceMultiQuestion {
  id: string;
  type: "multipleChoiceMulti";
  headline: string;
  subheader?: string;
  required: boolean;
  buttonLabel?: string;
  choices: Choice[];
}

export interface NPSQuestion {
  id: string;
  type: "nps";
  headline: string;
  subheader?: string;
  required: boolean;
  buttonLabel?: string;
  lowerLabel: string;
  upperLabel: string;
}

export interface Choice {
  id: string;
  label: string;
}
