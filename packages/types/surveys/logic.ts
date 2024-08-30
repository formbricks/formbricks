import { z } from "zod";

// export const ZSurveyOpenTextQuestionInputType = z.enum(["text", "email", "url", "number", "phone"]);

// export enum TSurveyQuestionTypeEnum {
//   FileUpload = "fileUpload",
//   OpenText = "openText",
//   MultipleChoiceSingle = "multipleChoiceSingle",
//   MultipleChoiceMulti = "multipleChoiceMulti",
//   NPS = "nps",
//   CTA = "cta",
//   Rating = "rating",
//   Consent = "consent",
//   PictureSelection = "pictureSelection",
//   Cal = "cal",
//   Date = "date",
//   Matrix = "matrix",
//   Address = "address",
// }

// export type TSurveyLogicCondition = z.infer<typeof ZSurveyLogicCondition>;

// export type TDyanmicLogicField = z.infer<typeof ZDyanmicLogicField>;

// const ZMatchValueBase = z.object({
//   type: z.enum(["static", "dynamic"]),
// });

// const ZMatchValueStatic = ZMatchValueBase.extend({
//   type: z.literal("static"),
//   value: z.union([z.string(), z.array(z.string()), z.number()]),
// });

// const ZMatchValueDynamic = ZMatchValueBase.extend({
//   type: z.literal("dynamic"),
//   id: z.string(),
//   fieldType: ZDyanmicLogicField,
// });

// const ZMatchValue = z.union([ZMatchValueStatic, ZMatchValueDynamic]);

// const ZLogicalConnector = z.enum(["and", "or"]);
// export type TLogicalConnector = z.infer<typeof ZLogicalConnector>;

// const ZConditionBase = z.object({
//   id: z.string().cuid2(),
//   connector: ZLogicalConnector.nullable(),
//   type: ZDyanmicLogicField,
//   conditionValue: z.string(),
//   conditionOperator: ZSurveyLogicCondition.nullable(),
//   matchValue: ZMatchValue.nullable(),
// });

// export type TConditionBase = z.infer<typeof ZConditionBase>;

// const ZConditionQuestionBase = ZConditionBase.extend({
//   type: z.literal("question"),
//   questionType: z.nativeEnum(TSurveyQuestionTypeEnum),
// });

// export type TConditionQuestionBase = z.infer<typeof ZConditionQuestionBase>;

// const ZOpenTextConditionBase = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.OpenText),
//   inputType: ZSurveyOpenTextQuestionInputType.optional().default("text"),
// });

// const ZOpenTextStringConditon = ZOpenTextConditionBase.extend({
//   inputType: z.enum(["text", "email", "url", "phone"]),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "contains",
//     "doesNotContain",
//     "startsWith",
//     "doesNotStartWith",
//     "endsWith",
//     "doesNotEndWith",
//     "isSubmitted",
//     "isSkipped",
//   ]),
//   matchValue: z.string().optional(),
// });

// const ZOpenTextNumberConditon = ZOpenTextConditionBase.extend({
//   inputType: z.literal("number"),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "isGreaterThan",
//     "isLessThan",
//     "isGreaterThanOrEqual",
//     "isLessThanOrEqual",
//     "isSubmitted",
//     "isSkipped",
//   ]),
//   matchValue: z.number().optional(),
// });

// const ZOpenTextCondition = z.union([ZOpenTextStringConditon, ZOpenTextNumberConditon]);

// const ZMultipleChoiceSingleCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.MultipleChoiceSingle),
//   conditionOperator: z.enum(["equals", "doesNotEqual", "equalsOneOf", "isSubmitted", "isSkipped"]),
// });

// const ZMultipleChoiceMultiCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.MultipleChoiceMulti),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "includesAllOf",
//     "includesOneOf",
//     "isSubmitted",
//     "isSkipped",
//   ]),
// });

// const ZPictureSelectionCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.PictureSelection),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "includesAllOf",
//     "includesOneOf",
//     "isSubmitted",
//     "isSkipped",
//   ]),
// });

// const ZRatingCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.Rating),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "isGreaterThan",
//     "isLessThan",
//     "isGreaterThanOrEqual",
//     "isLessThanOrEqual",
//     "isSubmitted",
//     "isSkipped",
//   ]),
//   matchValue: z.number().optional(),
// });

// const ZNPSCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.NPS),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "isGreaterThan",
//     "isLessThan",
//     "isGreaterThanOrEqual",
//     "isLessThanOrEqual",
//     "isSubmitted",
//     "isSkipped",
//   ]),
//   matchValue: z.number().optional(),
// });

// const ZCTACondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.CTA),
//   conditionOperator: z.enum(["isClicked", "isSkipped"]),
//   matchValue: z.undefined(),
// });

// const ZConsentCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.Consent),
//   conditionOperator: z.enum(["isAccepted", "isSkipped"]),
//   matchValue: z.undefined(),
// });

// const ZDateCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.Date),
//   conditionOperator: z.enum(["equals", "doesNotEqual", "isBefore", "isAfter", "isSubmitted", "isSkipped"]),
//   matchValue: z.string().optional(),
// });

// const ZFileUploadCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.FileUpload),
//   conditionOperator: z.enum(["isSubmitted", "isSkipped"]),
//   matchValue: z.undefined(),
// });

// const ZCalCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.Cal),
//   conditionOperator: z.enum(["isBooked", "isSkipped"]),
//   matchValue: z.undefined(),
// });

// const ZMatrixCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.Matrix),
//   conditionOperator: z.enum(["isPartiallySubmitted", "isCompletelySubmitted", "isSkipped"]),
//   matchValue: z.undefined(),
// });

// const ZAddressCondition = ZConditionQuestionBase.extend({
//   questionType: z.literal(TSurveyQuestionTypeEnum.Address),
//   conditionOperator: z.enum(["isSubmitted", "isSkipped"]),
//   matchValue: z.undefined(),
// });

// const ZConditionQuestion = z.union([
//   ZOpenTextCondition,
//   ZMultipleChoiceSingleCondition,
//   ZMultipleChoiceMultiCondition,
//   ZPictureSelectionCondition,
//   ZRatingCondition,
//   ZNPSCondition,
//   ZCTACondition,
//   ZConsentCondition,
//   ZDateCondition,
//   ZFileUploadCondition,
//   ZCalCondition,
//   ZMatrixCondition,
//   ZAddressCondition,
// ]);

// const ZConditionVariableBase = ZConditionBase.extend({
//   type: z.literal("variable"),
//   variableType: z.enum(["number", "text"]),
// });

// const ZConditionTextVariable = ZConditionVariableBase.extend({
//   variableType: z.literal("text"),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "contains",
//     "doesNotContain",
//     "startsWith",
//     "doesNotStartWith",
//     "endsWith",
//     "doesNotEndWith",
//   ]),
// });

// const ZConditionNumberVariable = ZConditionVariableBase.extend({
//   variableType: z.literal("number"),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "isGreaterThan",
//     "isLessThan",
//     "isGreaterThanOrEqual",
//     "isLessThanOrEqual",
//   ]),
// });

// const ZConditionVariable = z.union([ZConditionTextVariable, ZConditionNumberVariable]);

// const ZConditionAttributeClass = ZConditionBase.extend({
//   type: z.literal("attributeClass"),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "contains",
//     "doesNotContain",
//     "startsWith",
//     "doesNotStartWith",
//     "endsWith",
//     "doesNotEndWith",
//   ]),
// });

// const ZConditionHiddenField = ZConditionBase.extend({
//   type: z.literal("hiddenField"),
//   conditionOperator: z.enum([
//     "equals",
//     "doesNotEqual",
//     "contains",
//     "doesNotContain",
//     "startsWith",
//     "doesNotStartWith",
//     "endsWith",
//     "doesNotEndWith",
//   ]),
// });

// const ZCondition = z.union([
//   ZConditionQuestion,
//   ZConditionVariable,
//   ZConditionAttributeClass,
//   ZConditionHiddenField,
// ]);

// export type TCondition = z.infer<typeof ZCondition>;

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

export const ZDyanmicLogicField = z.enum(["question", "variable", "hiddenField"]);
export const ZActionObjective = z.enum(["calculate", "requireAnswer", "jumpToQuestion"]);
export const ZActionTextVariableCalculateOperator = z.enum(["assign", "concat"]);
export const ZActionNumberVariableCalculateOperator = z.enum([
  "add",
  "subtract",
  "multiply",
  "divide",
  "assign",
]);
export const ZActionVariableCalculateOperator = z.union([
  ZActionTextVariableCalculateOperator,
  ZActionNumberVariableCalculateOperator,
]);

export type TSurveyLogicCondition = z.infer<typeof ZSurveyLogicCondition>;
export type TDyanmicLogicField = z.infer<typeof ZDyanmicLogicField>;
export type TActionObjective = z.infer<typeof ZActionObjective>;
export type TActionTextVariableCalculateOperator = z.infer<typeof ZActionTextVariableCalculateOperator>;
export type TActionNumberVariableCalculateOperator = z.infer<typeof ZActionNumberVariableCalculateOperator>;
export type TActionVariableCalculateOperator = z.infer<typeof ZActionVariableCalculateOperator>;

// Conditions
const ZLeftOperandBase = z.object({
  type: ZDyanmicLogicField,
  id: z.string().cuid2(),
});

const ZLeftOperandHiddenField = ZLeftOperandBase.extend({
  type: z.literal("hiddenField"),
  id: z.string(),
});

export const ZLeftOperand = z.union([ZLeftOperandBase, ZLeftOperandHiddenField]);
export type TLeftOperand = z.infer<typeof ZLeftOperand>;

export const ZRightOperand = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("static"),
    value: z.union([z.string(), z.number(), z.array(z.string())]),
  }),
  z.object({
    type: z.literal("question"),
    value: z.string().cuid2(),
  }),
  z.object({
    type: z.literal("variable"),
    value: z.string().cuid2(),
  }),
  z.object({
    type: z.literal("hiddenField"),
    value: z.string(),
  }),
]);

export type TRightOperand = z.infer<typeof ZRightOperand>;

export const ZSingleCondition = z
  .object({
    id: z.string().cuid2(),
    leftOperand: ZLeftOperand,
    operator: ZSurveyLogicCondition,
    rightOperand: ZRightOperand.optional(),
  })
  .and(
    z.object({
      connector: z.undefined(),
    })
  );

export type TSingleCondition = z.infer<typeof ZSingleCondition>;

export interface TConditionGroup {
  id: string;
  connector: "and" | "or";
  conditions: (TSingleCondition | TConditionGroup)[];
}

const ZConditionGroup: z.ZodType<TConditionGroup> = z.lazy(() =>
  z.object({
    id: z.string().cuid2(),
    connector: z.enum(["and", "or"]),
    conditions: z.array(z.union([ZSingleCondition, ZConditionGroup])),
  })
);

// Actions
export const ZActionVariableValueType = z.union([z.literal("static"), ZDyanmicLogicField]);
export type TActionVariableValueType = z.infer<typeof ZActionVariableValueType>;

const ZActionBase = z.object({
  id: z.string().cuid2(),
  objective: ZActionObjective,
});

export type TActionBase = z.infer<typeof ZActionBase>;

const ZActionCalculate = ZActionBase.extend({
  objective: z.literal("calculate"),
  variableId: z.string(),
  operator: ZActionVariableCalculateOperator,
  value: z.object({
    type: z.union([z.literal("static"), ZDyanmicLogicField]),
    value: z.union([z.string(), z.number()]),
  }),
});

export type TActionCalculate = z.infer<typeof ZActionCalculate>;

const ZActionRequireAnswer = ZActionBase.extend({
  objective: z.literal("requireAnswer"),
  target: z.string(),
});
export type TActionRequireAnswer = z.infer<typeof ZActionRequireAnswer>;

const ZActionJumpToQuestion = ZActionBase.extend({
  objective: z.literal("jumpToQuestion"),
  target: z.string(),
});

export type TActionJumpToQuestion = z.infer<typeof ZActionJumpToQuestion>;

export const ZAction = z.union([ZActionCalculate, ZActionRequireAnswer, ZActionJumpToQuestion]);

export type TAction = z.infer<typeof ZAction>;

const ZSurveyAdvancedLogicActions = z.array(ZAction);

export const ZSurveyAdvancedLogic = z.object({
  id: z.string().cuid2(),
  conditions: ZConditionGroup,
  actions: ZSurveyAdvancedLogicActions,
});

export type TSurveyAdvancedLogic = z.infer<typeof ZSurveyAdvancedLogic>;
