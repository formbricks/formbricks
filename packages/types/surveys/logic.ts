import { z } from "zod";
import { TSurveyQuestionTypeEnum, ZSurveyOpenTextQuestionInputType } from "./types";

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

const ZDyanmicLogicField = z.enum(["question", "variable", "attributeClass", "hiddenField"]);

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
  conditionOperator: ZSurveyLogicCondition,
  matchValue: ZMatchValue,
});

const ZConditionQuestionBase = ZConditionBase.extend({
  type: z.literal("question"),
  questionType: z.nativeEnum(TSurveyQuestionTypeEnum),
});

const ZOpenTextConditionBase = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.OpenText),
  inputType: ZSurveyOpenTextQuestionInputType.optional().default("text"),
});

const ZOpenTextStringConditon = ZOpenTextConditionBase.extend({
  inputType: z.enum([
    ZSurveyOpenTextQuestionInputType.enum.text,
    ZSurveyOpenTextQuestionInputType.enum.email,
    ZSurveyOpenTextQuestionInputType.enum.url,
    ZSurveyOpenTextQuestionInputType.enum.phone,
  ]),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.contains,
    ZSurveyLogicCondition.Enum.doesNotContain,
    ZSurveyLogicCondition.Enum.startsWith,
    ZSurveyLogicCondition.Enum.doesNotStartWith,
    ZSurveyLogicCondition.Enum.endsWith,
    ZSurveyLogicCondition.Enum.doesNotEndWith,
    ZSurveyLogicCondition.Enum.isSubmitted,
    ZSurveyLogicCondition.Enum.isSkipped,
  ]),
  matchValue: z.string().optional(),
});

const ZOpenTextNumberConditon = ZOpenTextConditionBase.extend({
  inputType: z.literal(ZSurveyOpenTextQuestionInputType.enum.number),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.isGreaterThan,
    ZSurveyLogicCondition.Enum.isLessThan,
    ZSurveyLogicCondition.Enum.isGreaterThanOrEqual,
    ZSurveyLogicCondition.Enum.isLessThanOrEqual,
    ZSurveyLogicCondition.Enum.isSubmitted,
    ZSurveyLogicCondition.Enum.isSkipped,
  ]),
  matchValue: z.number().optional(),
});

const ZOpenTextCondition = z.union([ZOpenTextStringConditon, ZOpenTextNumberConditon]);

const ZMultipleChoiceSingleCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.MultipleChoiceSingle),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.equalsOneOf,
    ZSurveyLogicCondition.Enum.isSubmitted,
    ZSurveyLogicCondition.Enum.isSkipped,
  ]),
});

const ZMultipleChoiceMultiCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.MultipleChoiceMulti),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.includesAllOf,
    ZSurveyLogicCondition.Enum.includesOneOf,
    ZSurveyLogicCondition.Enum.isSubmitted,
    ZSurveyLogicCondition.Enum.isSkipped,
  ]),
});

const ZPictureSelectionCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.PictureSelection),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.includesAllOf,
    ZSurveyLogicCondition.Enum.includesOneOf,
    ZSurveyLogicCondition.Enum.isSubmitted,
    ZSurveyLogicCondition.Enum.isSkipped,
  ]),
});

const ZRatingCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Rating),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.isGreaterThan,
    ZSurveyLogicCondition.Enum.isLessThan,
    ZSurveyLogicCondition.Enum.isGreaterThanOrEqual,
    ZSurveyLogicCondition.Enum.isLessThanOrEqual,
    ZSurveyLogicCondition.Enum.isSubmitted,
    ZSurveyLogicCondition.Enum.isSkipped,
  ]),
  matchValue: z.number().optional(),
});

const ZNPSCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.NPS),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.isGreaterThan,
    ZSurveyLogicCondition.Enum.isLessThan,
    ZSurveyLogicCondition.Enum.isGreaterThanOrEqual,
    ZSurveyLogicCondition.Enum.isLessThanOrEqual,
    ZSurveyLogicCondition.Enum.isSubmitted,
    ZSurveyLogicCondition.Enum.isSkipped,
  ]),
  matchValue: z.number().optional(),
});

const ZCTACondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.CTA),
  conditionOperator: z.enum([ZSurveyLogicCondition.Enum.isClicked, ZSurveyLogicCondition.Enum.isSkipped]),
  matchValue: z.undefined(),
});

const ZConsentCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Consent),
  conditionOperator: z.enum([ZSurveyLogicCondition.Enum.isAccepted, ZSurveyLogicCondition.Enum.isSkipped]),
  matchValue: z.undefined(),
});

const ZDateCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Date),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.isBefore,
    ZSurveyLogicCondition.Enum.isAfter,
    ZSurveyLogicCondition.Enum.isSubmitted,
    ZSurveyLogicCondition.Enum.isSkipped,
  ]),
  matchValue: z.string().optional(),
});

const ZFileUploadCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.FileUpload),
  conditionOperator: z.enum([ZSurveyLogicCondition.Enum.isSubmitted, ZSurveyLogicCondition.Enum.isSkipped]),
  matchValue: z.undefined(),
});

const ZCalCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Cal),
  conditionOperator: z.enum([ZSurveyLogicCondition.Enum.isBooked, ZSurveyLogicCondition.Enum.isSkipped]),
  matchValue: z.undefined(),
});

const ZMatrixCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Matrix),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.isPartiallySubmitted,
    ZSurveyLogicCondition.Enum.isCompletelySubmitted,
    ZSurveyLogicCondition.Enum.isSkipped,
  ]),
  matchValue: z.undefined(),
});

const ZAddressCondition = ZConditionQuestionBase.extend({
  questionType: z.literal(TSurveyQuestionTypeEnum.Address),
  conditionOperator: z.enum([ZSurveyLogicCondition.Enum.isSubmitted, ZSurveyLogicCondition.Enum.isSkipped]),
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
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.contains,
    ZSurveyLogicCondition.Enum.doesNotContain,
    ZSurveyLogicCondition.Enum.startsWith,
    ZSurveyLogicCondition.Enum.doesNotStartWith,
    ZSurveyLogicCondition.Enum.endsWith,
    ZSurveyLogicCondition.Enum.doesNotEndWith,
  ]),
});

const ZConditionNumberVariable = ZConditionVariableBase.extend({
  variableType: z.literal("number"),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.isGreaterThan,
    ZSurveyLogicCondition.Enum.isLessThan,
    ZSurveyLogicCondition.Enum.isGreaterThanOrEqual,
    ZSurveyLogicCondition.Enum.isLessThanOrEqual,
  ]),
});

const ZConditionVariable = z.union([ZConditionTextVariable, ZConditionNumberVariable]);

const ZConditionAttributeClass = ZConditionBase.extend({
  type: z.literal("attributeClass"),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.contains,
    ZSurveyLogicCondition.Enum.doesNotContain,
    ZSurveyLogicCondition.Enum.startsWith,
    ZSurveyLogicCondition.Enum.doesNotStartWith,
    ZSurveyLogicCondition.Enum.endsWith,
    ZSurveyLogicCondition.Enum.doesNotEndWith,
  ]),
});

const ZConditionHiddenField = ZConditionBase.extend({
  type: z.literal("hiddenField"),
  conditionOperator: z.enum([
    ZSurveyLogicCondition.Enum.equals,
    ZSurveyLogicCondition.Enum.doesNotEqual,
    ZSurveyLogicCondition.Enum.contains,
    ZSurveyLogicCondition.Enum.doesNotContain,
    ZSurveyLogicCondition.Enum.startsWith,
    ZSurveyLogicCondition.Enum.doesNotStartWith,
    ZSurveyLogicCondition.Enum.endsWith,
    ZSurveyLogicCondition.Enum.doesNotEndWith,
  ]),
});

const ZCondition = z.union([
  ZConditionQuestion,
  ZConditionVariable,
  ZConditionAttributeClass,
  ZConditionHiddenField,
]);

export type TCondition = z.infer<typeof ZCondition>;

const ZActionBase = z.object({
  id: z.string().cuid2(),
  objective: z.enum(["calculate", "requireAnswer", "jumpToQuestion"]),
});

const ZActionCalculateBase = ZActionBase.extend({
  objective: z.literal("calculate"),
  target: z.string(),
});

const ZActionTextVariableCalculate = ZActionCalculateBase.extend({
  variableType: z.literal("text"),
  operator: z.enum(["assign", "concat"]),
  value: z.string(),
});

const ZActionNumberVariableCalculate = ZActionCalculateBase.extend({
  variableType: z.literal("number"),
  operator: z.enum(["add", "subtract", "multiply", "divide", "assign"]),
  value: z.number(),
});

const ZActionCalculate = z.union([ZActionTextVariableCalculate, ZActionNumberVariableCalculate]);

const ZActionRequireAnswer = ZActionBase.extend({
  objective: z.literal("requireAnswer"),
  target: z.string(),
});

const ZActionJumpToQuestion = ZActionBase.extend({
  objective: z.literal("jumpToQuestion"),
  target: z.string(),
});

const ZAction = z.union([ZActionCalculate, ZActionRequireAnswer, ZActionJumpToQuestion]);
export type TAction = z.infer<typeof ZAction>;

interface TGroupedConditions {
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

const ZSurveyLogic = z.object({
  id: z.string().cuid2(),
  conditions: z.array(z.union([ZCondition, ZGroupedConditions])),
  actions: z.array(ZAction),
});

export type TSurveyLogic = z.infer<typeof ZSurveyLogic>;

export const ZSurveyQuestionBase = z.object({
  logic: z.array(ZSurveyLogic).optional(),
});
