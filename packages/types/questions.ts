export type Question =
  | OpenTextQuestion
  | MultipleChoiceSingleQuestion
  | MultipleChoiceMultiQuestion
  | NPSQuestion
  | CTAQuestion
  | RatingQuestion;

export interface IQuestion {
  id: string;
  type: string;
  headline: string;
  subheader?: string;
  required: boolean;
  buttonLabel?: string;
}

export interface OpenTextQuestion extends IQuestion {
  type: "openText";
  placeholder?: string;
}

export interface MultipleChoiceSingleQuestion extends IQuestion {
  type: "multipleChoiceSingle";
  choices: Choice[];
}

export interface MultipleChoiceMultiQuestion extends IQuestion {
  type: "multipleChoiceMulti";
  choices: Choice[];
}

export interface NPSQuestion extends IQuestion {
  type: "nps";
  lowerLabel: string;
  upperLabel: string;
}

export interface CTAQuestion extends IQuestion {
  type: "cta";
  html?: string;
  buttonUrl?: string;
  buttonExternal: boolean;
  dismissButtonLabel?: string;
}

export interface RatingQuestion extends IQuestion {
  type: "rating";
  scale: "number" | "smiley" | "star";
  range: 5 | 3 | 4 | 7 | 10;
  lowerLabel: string;
  upperLabel: string;
}

export interface Choice {
  id: string;
  label: string;
}
