import { z } from "zod";

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
export const ZActionTextVariableCalculateOperator = z.enum(["assign", "concat"], {
  message: "Invalid operator for a text variable",
});
export const ZActionNumberVariableCalculateOperator = z.enum(
  ["add", "subtract", "multiply", "divide", "assign"],
  { message: "Invalid operator for a number variable" }
);

const ZDynamicQuestion = z.object({
  type: z.literal("question"),
  value: z.string().min(1, "Question id cannot be empty"),
});

const ZDynamicVariable = z.object({
  type: z.literal("variable"),
  value: z
    .string()
    .cuid2({ message: "Variable id must be a valid cuid" })
    .min(1, "Variable id cannot be empty"),
});

const ZDynamicHiddenField = z.object({
  type: z.literal("hiddenField"),
  value: z.string().min(1, "Hidden field id cannot be empty"),
});

const ZDynamicLogicFieldValue = z.union([ZDynamicQuestion, ZDynamicVariable, ZDynamicHiddenField], {
  message: "Invalid dynamic field value",
});

export type TSurveyLogicCondition = z.infer<typeof ZSurveyLogicCondition>;
export type TDyanmicLogicField = z.infer<typeof ZDyanmicLogicField>;
export type TActionObjective = z.infer<typeof ZActionObjective>;
export type TActionTextVariableCalculateOperator = z.infer<typeof ZActionTextVariableCalculateOperator>;
export type TActionNumberVariableCalculateOperator = z.infer<typeof ZActionNumberVariableCalculateOperator>;

// Conditions
const ZLeftOperand = ZDynamicLogicFieldValue;
export type TLeftOperand = z.infer<typeof ZLeftOperand>;

export const ZRightOperandStatic = z.object({
  type: z.literal("static"),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const ZRightOperand = z.union([ZRightOperandStatic, ZDynamicLogicFieldValue]);
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

const ZActionCalculateBase = ZActionBase.extend({
  objective: z.literal("calculate"),
  variableId: z.string(),
});

export const ZActionCalculateText = ZActionCalculateBase.extend({
  operator: ZActionTextVariableCalculateOperator,
  value: z.union([
    z.object({
      type: z.literal("static"),
      value: z
        .string({ message: "Value must be a string for text variable" })
        .min(1, "please enter a value in logic field"),
    }),
    ZDynamicLogicFieldValue,
  ]),
});

export const ZActionCalculateNumber = ZActionCalculateBase.extend({
  operator: ZActionNumberVariableCalculateOperator,
  value: z.union([
    z.object({
      type: z.literal("static"),
      value: z.number({ message: "Value must be a number for number variable" }),
    }),
    ZDynamicLogicFieldValue,
  ]),
});

const ZActionCalculate = z.union([ZActionCalculateText, ZActionCalculateNumber]);

export type TActionCalculate = z.infer<typeof ZActionCalculate>;

const ZActionRequireAnswer = ZActionBase.extend({
  objective: z.literal("requireAnswer"),
  target: z.string().min(1, "Target question id cannot be empty"),
});
export type TActionRequireAnswer = z.infer<typeof ZActionRequireAnswer>;

const ZActionJumpToQuestion = ZActionBase.extend({
  objective: z.literal("jumpToQuestion"),
  target: z.string().min(1, "Target question id cannot be empty"),
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
