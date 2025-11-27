import { z } from "zod";
import { ZId } from "../common";

// Logic operators
export const ZSurveyLogicConditionsOperator = z.enum([
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
  "doesNotIncludeOneOf",
  "doesNotIncludeAllOf",
  "isClicked",
  "isNotClicked",
  "isAccepted",
  "isBefore",
  "isAfter",
  "isBooked",
  "isPartiallySubmitted",
  "isCompletelySubmitted",
  "isSet",
  "isNotSet",
  "isEmpty",
  "isNotEmpty",
  "isAnyOf",
]);

export type TSurveyLogicConditionsOperator = z.infer<typeof ZSurveyLogicConditionsOperator>;

// Variable calculate operators
export const ZActionTextVariableCalculateOperator = z.enum(["assign", "concat"], {
  message: "Conditional Logic: Invalid operator for a text variable",
});

export const ZActionNumberVariableCalculateOperator = z.enum(
  ["add", "subtract", "multiply", "divide", "assign"],
  { message: "Conditional Logic: Invalid operator for a number variable" }
);

export type TActionTextVariableCalculateOperator = z.infer<typeof ZActionTextVariableCalculateOperator>;
export type TActionNumberVariableCalculateOperator = z.infer<typeof ZActionNumberVariableCalculateOperator>;

// Connector
export const ZConnector = z.enum(["and", "or"]);
export type TConnector = z.infer<typeof ZConnector>;

// Dynamic field types for conditions
const ZDynamicElement = z.object({
  type: z.literal("element"),
  value: z.string().min(1, "Conditional Logic: Element id cannot be empty"),
  meta: z.record(z.string()).optional(),
});

const ZDynamicVariable = z.object({
  type: z.literal("variable"),
  value: z
    .string()
    .cuid2({ message: "Conditional Logic: Variable id must be a valid cuid" })
    .min(1, "Conditional Logic: Variable id cannot be empty"),
});

const ZDynamicHiddenField = z.object({
  type: z.literal("hiddenField"),
  value: z.string().min(1, "Conditional Logic: Hidden field id cannot be empty"),
});

export const ZDynamicLogicFieldValue = z.union([ZDynamicElement, ZDynamicVariable, ZDynamicHiddenField], {
  message: "Conditional Logic: Invalid dynamic field value",
});

export type TDynamicLogicFieldValue = z.infer<typeof ZDynamicLogicFieldValue>;

// DEPRECATED: Backward compatibility for API - accepts "question" instead of "element"
// This is used in API input validation to support old clients
const ZDynamicQuestion = z.object({
  type: z.literal("question"),
  value: z.string().min(1, "Conditional Logic: Question id cannot be empty"),
  meta: z.record(z.string()).optional(),
});

export const ZDynamicLogicFieldValueDeprecated = z.union(
  [ZDynamicQuestion, ZDynamicElement, ZDynamicVariable, ZDynamicHiddenField],
  {
    message: "Conditional Logic: Invalid dynamic field value",
  }
);

export type TDynamicLogicFieldValueDeprecated = z.infer<typeof ZDynamicLogicFieldValueDeprecated>;

// Right operand for conditions
export const ZRightOperandStatic = z.object({
  type: z.literal("static"),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

const _ZLeftOperand = ZDynamicLogicFieldValue;
export type TLeftOperand = z.infer<typeof _ZLeftOperand>;

export const ZRightOperand = z.union([ZRightOperandStatic, ZDynamicLogicFieldValue]);
export type TRightOperand = z.infer<typeof ZRightOperand>;

// DEPRECATED: Backward compatibility for API
export const ZRightOperandDeprecated = z.union([ZRightOperandStatic, ZDynamicLogicFieldValueDeprecated]);
export type TRightOperandDeprecated = z.infer<typeof ZRightOperandDeprecated>;

// Operators that don't require a right operand
export const operatorsWithoutRightOperand = [
  ZSurveyLogicConditionsOperator.Enum.isSubmitted,
  ZSurveyLogicConditionsOperator.Enum.isSkipped,
  ZSurveyLogicConditionsOperator.Enum.isClicked,
  ZSurveyLogicConditionsOperator.Enum.isNotClicked,
  ZSurveyLogicConditionsOperator.Enum.isAccepted,
  ZSurveyLogicConditionsOperator.Enum.isBooked,
  ZSurveyLogicConditionsOperator.Enum.isPartiallySubmitted,
  ZSurveyLogicConditionsOperator.Enum.isCompletelySubmitted,
  ZSurveyLogicConditionsOperator.Enum.isSet,
  ZSurveyLogicConditionsOperator.Enum.isNotSet,
  ZSurveyLogicConditionsOperator.Enum.isEmpty,
  ZSurveyLogicConditionsOperator.Enum.isNotEmpty,
] as const;

// Single condition
export const ZSingleCondition = z
  .object({
    id: ZId,
    leftOperand: ZDynamicLogicFieldValue,
    operator: ZSurveyLogicConditionsOperator,
    rightOperand: ZRightOperand.optional(),
  })
  .and(
    z.object({
      connector: z.undefined(),
    })
  )
  .superRefine((val, ctx) => {
    if (
      !operatorsWithoutRightOperand.includes(val.operator as (typeof operatorsWithoutRightOperand)[number])
    ) {
      if (val.rightOperand === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: right operand is required for operator "${val.operator}"`,
          path: ["rightOperand"],
        });
      } else if (val.rightOperand.type === "static" && val.rightOperand.value === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: right operand value cannot be empty for operator "${val.operator}"`,
        });
      }
    } else if (val.rightOperand !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: right operand should not be present for operator "${val.operator}"`,
        path: ["rightOperand"],
      });
    }
  });

export type TSingleCondition = z.infer<typeof ZSingleCondition>;

// DEPRECATED: Backward compatibility for API - accepts "question" type
export const ZSingleConditionDeprecated = z
  .object({
    id: ZId,
    leftOperand: ZDynamicLogicFieldValueDeprecated,
    operator: ZSurveyLogicConditionsOperator,
    rightOperand: ZRightOperandDeprecated.optional(),
  })
  .and(
    z.object({
      connector: z.undefined(),
    })
  )
  .superRefine((val, ctx) => {
    if (
      !operatorsWithoutRightOperand.includes(val.operator as (typeof operatorsWithoutRightOperand)[number])
    ) {
      if (val.rightOperand === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: right operand is required for operator "${val.operator}"`,
          path: ["rightOperand"],
        });
      } else if (val.rightOperand.type === "static" && val.rightOperand.value === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: right operand value cannot be empty for operator "${val.operator}"`,
        });
      }
    } else if (val.rightOperand !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: right operand should not be present for operator "${val.operator}"`,
        path: ["rightOperand"],
      });
    }
  });

export type TSingleConditionDeprecated = z.infer<typeof ZSingleConditionDeprecated>;

export const ZConditionGroup: z.ZodType<TConditionGroup> = z.lazy(() =>
  z.object({
    id: ZId,
    connector: ZConnector,
    conditions: z.array(z.union([ZSingleCondition, ZConditionGroup])),
  })
);

export interface TConditionGroup {
  id: string;
  connector: TConnector;
  conditions: (TSingleCondition | TConditionGroup)[];
}

// DEPRECATED: Backward compatibility for API
export const ZConditionGroupDeprecated: z.ZodType<TConditionGroupDeprecated> = z.lazy(() =>
  z.object({
    id: ZId,
    connector: ZConnector,
    conditions: z.array(z.union([ZSingleConditionDeprecated, ZConditionGroupDeprecated])),
  })
);

export interface TConditionGroupDeprecated {
  id: string;
  connector: TConnector;
  conditions: (TSingleConditionDeprecated | TConditionGroupDeprecated)[];
}
