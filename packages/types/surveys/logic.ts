import { z } from "zod";

// import { TSurveyQuestionTypeEnum, ZSurveyOpenTextQuestionInputType } from "./types";

export const ZSurveyOpenTextQuestionInputType = z.enum(["text", "email", "url", "number", "phone"]);

export enum TSurveyQuestionTypeEnum {
  FileUpload = "fileUpload",
  OpenText = "openText",
  MultipleChoiceSingle = "multipleChoiceSingle",
  MultipleChoiceMulti = "multipleChoiceMulti",
  NPS = "nps",
  CTA = "cta",
  Rating = "rating",
  Consent = "consent",
  PictureSelection = "pictureSelection",
  Cal = "cal",
  Date = "date",
  Matrix = "matrix",
  Address = "address",
}

export const ZSurveyLogicCondition = z.enum([
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",
  "startsWith",
  "doesNotStartWith",
  "endsWith",
  "doesNotEndWith",
  "isSubmitted",
  "isSkipped",
  "isGreaterThan",
  "isLessThan",
  "isGreaterThanOrEqual",
  "isLessThanOrEqual",
  "equalsOneOf",
  "includesAllOf",
  "includesOneOf",
  "isClicked",
  "isAccepted",
  "isBefore",
  "isAfter",
  "isBooked",
  "isPartiallySubmitted",
  "isCompletelySubmitted",
]);

export type TSurveyLogicCondition = z.infer<typeof ZSurveyLogicCondition>;

export const ZDyanmicLogicField = z.enum(["question", "variable", "attributeClass", "hiddenField"]);

export type TDyanmicLogicField = z.infer<typeof ZDyanmicLogicField>;

const ZMatchValueBase = z.object({
  type: z.enum(["static", "dynamic"]),
});

const ZMatchValueStatic = ZMatchValueBase.extend({
  type: z.literal("static"),
  value: z.union([z.string(), z.array(z.string()), z.number()]),
});

const ZMatchValueDynamic = ZMatchValueBase.extend({
  type: z.literal("dynamic"),
  id: z.string(),
  fieldType: ZDyanmicLogicField,
});

const ZMatchValue = z.union([ZMatchValueStatic, ZMatchValueDynamic]);

const ZLogicalConnector = z.enum(["and", "or"]);
export type TLogicalConnector = z.infer<typeof ZLogicalConnector>;

const ZConditionBase = z.object({
  id: z.string().cuid2(),
  connector: ZLogicalConnector.nullable(),
  type: ZDyanmicLogicField,
  conditionValue: z.string(),
  conditionOperator: ZSurveyLogicCondition.nullable(),
  matchValue: ZMatchValue.nullable(),
});

export type TConditionBase = z.infer<typeof ZConditionBase>;

const ZConditionQuestionBase = ZConditionBase.extend({
  type: z.literal("question"),
  questionType: z.nativeEnum(TSurveyQuestionTypeEnum),
});

export type TConditionQuestionBase = z.infer<typeof ZConditionQuestionBase>;

const ZOpenTextConditionBase = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.OpenText),
  inputType: ZSurveyOpenTextQuestionInputType.optional().default("text"),
});

const ZOpenTextStringConditon = ZOpenTextConditionBase.extend({
  inputType: z.enum(["text", "email", "url", "phone"]),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
    "startsWith",
    "doesNotStartWith",
    "endsWith",
    "doesNotEndWith",
    "isSubmitted",
    "isSkipped",
  ]),
  matchValue: z.string().optional(),
});

const ZOpenTextNumberConditon = ZOpenTextConditionBase.extend({
  inputType: z.literal("number"),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "isGreaterThan",
    "isLessThan",
    "isGreaterThanOrEqual",
    "isLessThanOrEqual",
    "isSubmitted",
    "isSkipped",
  ]),
  matchValue: z.number().optional(),
});

const ZOpenTextCondition = z.union([ZOpenTextStringConditon, ZOpenTextNumberConditon]);

const ZMultipleChoiceSingleCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.MultipleChoiceSingle),
  conditionOperator: z.enum(["equals", "doesNotEqual", "equalsOneOf", "isSubmitted", "isSkipped"]),
});

const ZMultipleChoiceMultiCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.MultipleChoiceMulti),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "includesAllOf",
    "includesOneOf",
    "isSubmitted",
    "isSkipped",
  ]),
});

const ZPictureSelectionCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.PictureSelection),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "includesAllOf",
    "includesOneOf",
    "isSubmitted",
    "isSkipped",
  ]),
});

const ZRatingCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Rating),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "isGreaterThan",
    "isLessThan",
    "isGreaterThanOrEqual",
    "isLessThanOrEqual",
    "isSubmitted",
    "isSkipped",
  ]),
  matchValue: z.number().optional(),
});

const ZNPSCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.NPS),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "isGreaterThan",
    "isLessThan",
    "isGreaterThanOrEqual",
    "isLessThanOrEqual",
    "isSubmitted",
    "isSkipped",
  ]),
  matchValue: z.number().optional(),
});

const ZCTACondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.CTA),
  conditionOperator: z.enum(["isClicked", "isSkipped"]),
  matchValue: z.undefined(),
});

const ZConsentCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Consent),
  conditionOperator: z.enum(["isAccepted", "isSkipped"]),
  matchValue: z.undefined(),
});

const ZDateCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Date),
  conditionOperator: z.enum(["equals", "doesNotEqual", "isBefore", "isAfter", "isSubmitted", "isSkipped"]),
  matchValue: z.string().optional(),
});

const ZFileUploadCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.FileUpload),
  conditionOperator: z.enum(["isSubmitted", "isSkipped"]),
  matchValue: z.undefined(),
});

const ZCalCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Cal),
  conditionOperator: z.enum(["isBooked", "isSkipped"]),
  matchValue: z.undefined(),
});

const ZMatrixCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Matrix),
  conditionOperator: z.enum(["isPartiallySubmitted", "isCompletelySubmitted", "isSkipped"]),
  matchValue: z.undefined(),
});

const ZAddressCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Address),
  conditionOperator: z.enum(["isSubmitted", "isSkipped"]),
  matchValue: z.undefined(),
});

const ZConditionQuestion = z.union([
  ZOpenTextCondition,
  ZMultipleChoiceSingleCondition,
  ZMultipleChoiceMultiCondition,
  ZPictureSelectionCondition,
  ZRatingCondition,
  ZNPSCondition,
  ZCTACondition,
  ZConsentCondition,
  ZDateCondition,
  ZFileUploadCondition,
  ZCalCondition,
  ZMatrixCondition,
  ZAddressCondition,
]);

const ZConditionVariableBase = ZConditionBase.extend({
  type: z.literal("variable"),
  variableType: z.enum(["number", "text"]),
});

const ZConditionTextVariable = ZConditionVariableBase.extend({
  variableType: z.literal("text"),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
    "startsWith",
    "doesNotStartWith",
    "endsWith",
    "doesNotEndWith",
  ]),
});

const ZConditionNumberVariable = ZConditionVariableBase.extend({
  variableType: z.literal("number"),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "isGreaterThan",
    "isLessThan",
    "isGreaterThanOrEqual",
    "isLessThanOrEqual",
  ]),
});

const ZConditionVariable = z.union([ZConditionTextVariable, ZConditionNumberVariable]);

const ZConditionAttributeClass = ZConditionBase.extend({
  type: z.literal("attributeClass"),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
    "startsWith",
    "doesNotStartWith",
    "endsWith",
    "doesNotEndWith",
  ]),
});

const ZConditionHiddenField = ZConditionBase.extend({
  type: z.literal("hiddenField"),
  conditionOperator: z.enum([
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
    "startsWith",
    "doesNotStartWith",
    "endsWith",
    "doesNotEndWith",
  ]),
});

const ZCondition = z.union([
  ZConditionQuestion,
  ZConditionVariable,
  ZConditionAttributeClass,
  ZConditionHiddenField,
]);

export type TCondition = z.infer<typeof ZCondition>;

export enum TActionObjective {
  Calculate = "calculate",
  RequireAnswer = "requireAnswer",
  JumpToQuestion = "jumpToQuestion",
}

export const ZActionObjective = z.nativeEnum(TActionObjective);

const ZActionBase = z.object({
  id: z.string().cuid2(),
  objective: ZActionObjective,
  target: z.string(),
});

export type TActionBase = z.infer<typeof ZActionBase>;

export enum TActionCalculateVariableType {
  Number = "number",
  Text = "text",
}

export const ZActionCalculateVariableType = z.nativeEnum(TActionCalculateVariableType);

const ZActionCalculateBase = ZActionBase.extend({
  objective: z.literal("calculate"),
  target: z.string(),
  variableType: ZActionCalculateVariableType,
});

export enum TActionTextVariableCalculateOperator {
  Assign = "assign",
  Concat = "concat",
}

export const ZActionTextVariableCalculateOperator = z.nativeEnum(TActionTextVariableCalculateOperator);

const ZActionTextVariableCalculate = ZActionCalculateBase.extend({
  variableType: z.literal(TActionCalculateVariableType.Text),
  operator: ZActionTextVariableCalculateOperator,
  value: z.union([z.string(), ZMatchValueDynamic]),
});

export enum TActionNumberVariableCalculateOperator {
  Add = "add",
  Subtract = "subtract",
  Multiply = "multiply",
  Divide = "divide",
  Assign = "assign",
}

export const ZActionNumberVariableCalculateOperator = z.nativeEnum(TActionNumberVariableCalculateOperator);

const ZActionNumberVariableCalculate = ZActionCalculateBase.extend({
  variableType: z.literal(TActionCalculateVariableType.Number),
  operator: ZActionNumberVariableCalculateOperator,
  value: z.union([z.number(), ZMatchValueDynamic]),
});

export const ZActionCalculate = z.union([ZActionTextVariableCalculate, ZActionNumberVariableCalculate]);

export type TActionCalculate = z.infer<typeof ZActionCalculate>;

const ZActionRequireAnswer = ZActionBase.extend({
  objective: z.literal("requireAnswer"),
});

const ZActionJumpToQuestion = ZActionBase.extend({
  objective: z.literal("jumpToQuestion"),
});

const ZAction = z.union([ZActionCalculate, ZActionRequireAnswer, ZActionJumpToQuestion]);
export type TAction = z.infer<typeof ZAction>;

export interface TGroupedConditions {
  id: string;
  type: "group";
  connector: TLogicalConnector;
  conditions: (TCondition | TGroupedConditions)[];
}

const ZGroupedConditions: z.ZodType<TGroupedConditions> = z.object({
  id: z.string().cuid2(),
  type: z.literal("group"),
  connector: ZLogicalConnector,
  conditions: z.array(z.union([ZCondition, z.lazy(() => ZGroupedConditions)])),
});

export const ZSurveyAdvancedLogic = z.object({
  id: z.string().cuid2(),
  conditions: z.array(z.union([ZCondition, ZGroupedConditions])),
  actions: z.array(ZAction),
});

export type TSurveyAdvancedLogic = z.infer<typeof ZSurveyAdvancedLogic>;

export const ZSurveyQuestionBase = z.object({
  logic: z.array(ZSurveyAdvancedLogic).optional(),
});
