/* eslint-disable import/no-cycle -- Required for circular dependency between types, blocks, and elements */
import { z } from "zod";
import { ZId } from "../common";
import { ZSurveyElementId, ZSurveyElements } from "./elements";
import type { TSurveyLogicConditionsOperator } from "./types";
import {
  ZActionNumberVariableCalculateOperator,
  ZActionTextVariableCalculateOperator,
  ZConnector,
  ZI18nString,
  ZSurveyLogicConditionsOperator,
} from "./types";

// Block ID - CUID (system-generated, NOT user-editable)
export const ZSurveyBlockId = z.string().cuid2();

export type TSurveyBlockId = z.infer<typeof ZSurveyBlockId>;

// Copy condition types from types.ts for block logic
const ZDynamicQuestion = z.object({
  type: z.literal("question"),
  value: z.string().min(1, "Conditional Logic: Question id cannot be empty"),
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

const ZDynamicLogicFieldValue = z.union([ZDynamicQuestion, ZDynamicVariable, ZDynamicHiddenField], {
  message: "Conditional Logic: Invalid dynamic field value",
});

const ZLeftOperand = ZDynamicLogicFieldValue;
export type TLeftOperand = z.infer<typeof ZLeftOperand>;

export const ZRightOperandStatic = z.object({
  type: z.literal("static"),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const ZRightOperand = z.union([ZRightOperandStatic, ZDynamicLogicFieldValue]);
export type TRightOperand = z.infer<typeof ZRightOperand>;

const operatorsWithoutRightOperand: readonly TSurveyLogicConditionsOperator[] = [
  ZSurveyLogicConditionsOperator.Enum.isSubmitted,
  ZSurveyLogicConditionsOperator.Enum.isSkipped,
  ZSurveyLogicConditionsOperator.Enum.isClicked,
  ZSurveyLogicConditionsOperator.Enum.isAccepted,
  ZSurveyLogicConditionsOperator.Enum.isBooked,
  ZSurveyLogicConditionsOperator.Enum.isPartiallySubmitted,
  ZSurveyLogicConditionsOperator.Enum.isCompletelySubmitted,
  ZSurveyLogicConditionsOperator.Enum.isSet,
  ZSurveyLogicConditionsOperator.Enum.isNotSet,
  ZSurveyLogicConditionsOperator.Enum.isEmpty,
  ZSurveyLogicConditionsOperator.Enum.isNotEmpty,
];

export const ZSingleCondition = z
  .object({
    id: ZId,
    leftOperand: ZLeftOperand,
    operator: ZSurveyLogicConditionsOperator,
    rightOperand: ZRightOperand.optional(),
  })
  .and(
    z.object({
      connector: z.undefined(),
    })
  )
  .superRefine((val, ctx) => {
    if (!operatorsWithoutRightOperand.includes(val.operator)) {
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

export interface TConditionGroup {
  id: string;
  connector: z.infer<typeof ZConnector>;
  conditions: (TSingleCondition | TConditionGroup)[];
}

const ZConditionGroup: z.ZodType<TConditionGroup> = z.lazy(() =>
  z.object({
    id: ZId,
    connector: ZConnector,
    conditions: z.array(z.union([ZSingleCondition, ZConditionGroup])),
  })
);

// Block Logic - Actions
const ZActionCalculateBase = z.object({
  id: ZId,
  objective: z.literal("calculate"),
  variableId: z.string(),
});

export const ZActionCalculateText = ZActionCalculateBase.extend({
  operator: ZActionTextVariableCalculateOperator,
  value: z.union([
    z.object({
      type: z.literal("static"),
      value: z
        .string({ message: "Conditional Logic: Value must be a string for text variable" })
        .min(1, "Conditional Logic: Please enter a value in logic field"),
    }),
    ZDynamicLogicFieldValue,
  ]),
});

export const ZActionCalculateNumber = ZActionCalculateBase.extend({
  operator: ZActionNumberVariableCalculateOperator,
  value: z.union([
    z.object({
      type: z.literal("static"),
      value: z.number({ message: "Conditional Logic: Value must be a number for number variable" }),
    }),
    ZDynamicLogicFieldValue,
  ]),
}).superRefine((val, ctx) => {
  if (val.operator === "divide" && val.value.type === "static" && val.value.value === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conditional Logic: Cannot divide by zero",
      path: ["value", "value"],
    });
  }
});

export const ZActionCalculate = z.union([ZActionCalculateText, ZActionCalculateNumber]);

export type TActionCalculate = z.infer<typeof ZActionCalculate>;

// RequireAnswer action - targets element IDs

export const ZActionRequireAnswer = z.object({
  id: ZId,
  objective: z.literal("requireAnswer"),
  target: ZSurveyElementId, // Targets elements, validated to be outside current block
});

export type TActionRequireAnswer = z.infer<typeof ZActionRequireAnswer>;

// JumpToBlock action - targets block IDs (CUIDs)

export const ZActionJumpToBlock = z.object({
  id: ZId,
  objective: z.literal("jumpToBlock"),
  target: ZSurveyBlockId, // Must be a valid CUID
});

export type TActionJumpToBlock = z.infer<typeof ZActionJumpToBlock>;

// Block logic actions

export const ZSurveyBlockLogicAction = z.union([ZActionCalculate, ZActionRequireAnswer, ZActionJumpToBlock]);

export type TSurveyBlockLogicAction = z.infer<typeof ZSurveyBlockLogicAction>;

const ZSurveyBlockLogicActions = z.array(ZSurveyBlockLogicAction);
export type TSurveyBlockLogicActions = z.infer<typeof ZSurveyBlockLogicActions>;

// Block Logic

export const ZSurveyBlockLogic = z.object({
  id: ZId,
  conditions: ZConditionGroup,
  actions: ZSurveyBlockLogicActions,
});

export type TSurveyBlockLogic = z.infer<typeof ZSurveyBlockLogic>;

// Block definition
export const ZSurveyBlock = z
  .object({
    id: ZSurveyBlockId, // CUID
    name: z.string().min(1, { message: "Block name is required" }), // REQUIRED for editor
    elements: ZSurveyElements.min(1, { message: "Block must have at least one element" }),
    logic: z.array(ZSurveyBlockLogic).optional(),
    logicFallback: ZSurveyBlockId.optional(),
    buttonLabel: ZI18nString.optional(),
    backButtonLabel: ZI18nString.optional(),
    isDraft: z.boolean().optional(),
  })
  .superRefine((block, ctx) => {
    // Validate element IDs are unique within block
    const elementIds = block.elements.map((e) => e.id);
    const uniqueElementIds = new Set(elementIds);
    if (uniqueElementIds.size !== elementIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Element IDs must be unique within a block",
        path: [elementIds.findIndex((id, index) => elementIds.indexOf(id) !== index), "id"],
      });
    }
  });

export type TSurveyBlock = z.infer<typeof ZSurveyBlock>;

export const ZSurveyBlocks = z.array(ZSurveyBlock);
export type TSurveyBlocks = z.infer<typeof ZSurveyBlocks>;
