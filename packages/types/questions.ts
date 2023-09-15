export interface Choice {
  id: string;
  label: string;
}

export enum QuestionType {
  OpenText = "openText",
  MultipleChoiceSingle = "multipleChoiceSingle",
  MultipleChoiceMulti = "multipleChoiceMulti",
  NPS = "nps",
  CTA = "cta",
  Rating = "rating",
  Consent = "consent",
}

export type Question =
  | OpenTextQuestion
  | MultipleChoiceSingleQuestion
  | MultipleChoiceMultiQuestion
  | NPSQuestion
  | CTAQuestion
  | RatingQuestion
  | ConsentQuestion;

export interface IQuestion<T extends Logic> {
  id: string;
  type: string;
  headline: string;
  subheader?: string;
  required: boolean;
  buttonLabel?: string;
  backButtonLabel?: string;
  logic?: T[];
  isDraft?: boolean;
}

export interface OpenTextQuestion extends IQuestion<OpenTextLogic> {
  type: QuestionType.OpenText;
  longAnswer?: boolean;
  placeholder?: string;
}

export interface MultipleChoiceSingleQuestion extends IQuestion<MultipleChoiceSingleLogic> {
  type: QuestionType.MultipleChoiceSingle;
  choices: Choice[];
  shuffleOption: string;
}

export interface MultipleChoiceMultiQuestion extends IQuestion<MultipleChoiceMultiLogic> {
  type: QuestionType.MultipleChoiceMulti;
  choices: Choice[];
  shuffleOption: string;
}

export interface NPSQuestion extends IQuestion<NPSLogic> {
  type: QuestionType.NPS;
  lowerLabel: string;
  upperLabel: string;
}

export interface CTAQuestion extends IQuestion<CTALogic> {
  type: QuestionType.CTA;
  html?: string;
  buttonUrl?: string;
  buttonExternal: boolean;
  dismissButtonLabel?: string;
}

export interface RatingQuestion extends IQuestion<RatingLogic> {
  type: QuestionType.Rating;
  scale: "number" | "smiley" | "star";
  range: 5 | 3 | 4 | 7 | 10;
  lowerLabel: string;
  upperLabel: string;
}

export interface ConsentQuestion extends IQuestion<CTALogic> {
  type: "consent";
  html?: string;
  label: string;
  dismissButtonLabel?: string;
}

export type LogicCondition =
  | "submitted"
  | "skipped"
  | "accepted"
  | "clicked"
  | "equals"
  | "notEquals"
  | "lessThan"
  | "lessEqual"
  | "greaterThan"
  | "greaterEqual"
  | "includesAll"
  | "includesOne";

export interface LogicBase {
  condition: LogicCondition | undefined;
  value?: number | string | string[] | undefined;
  destination: string | "end" | undefined;
}

export interface OpenTextLogic extends LogicBase {
  condition: "submitted" | "skipped" | undefined;
  value?: undefined;
}
export interface MultipleChoiceSingleLogic extends LogicBase {
  condition: "submitted" | "skipped" | "equals" | "notEquals" | undefined;
  value?: string;
}
export interface MultipleChoiceMultiLogic extends LogicBase {
  condition: "submitted" | "skipped" | "includesAll" | "includesOne" | undefined;
  value?: string[];
}
export interface NPSLogic extends LogicBase {
  condition:
    | "submitted"
    | "skipped"
    | "lessThan"
    | "lessEqual"
    | "greaterThan"
    | "greaterEqual"
    | "equals"
    | "notEquals"
    | undefined;
  value?: number;
}
export interface CTALogic extends LogicBase {
  condition: "clicked" | "skipped" | undefined;
  value?: undefined;
}
export interface RatingLogic extends LogicBase {
  condition:
    | "submitted"
    | "skipped"
    | "lessThan"
    | "lessEqual"
    | "greaterThan"
    | "greaterEqual"
    | "equals"
    | "notEquals"
    | undefined;
  value?: number | string;
}

export interface ConsentLogic extends LogicBase {
  condition: "submitted" | "skipped" | "accepted" | undefined;
  value: undefined;
}

export type Logic =
  | OpenTextLogic
  | MultipleChoiceSingleLogic
  | MultipleChoiceMultiLogic
  | NPSLogic
  | CTALogic
  | RatingLogic
  | ConsentLogic;
