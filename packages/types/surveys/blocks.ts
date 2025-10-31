import { z } from "zod";
import { ZId } from "../common";
import { ZI18nString } from "../i18n";
import { ZSurveyElementId, ZSurveyElements } from "./elements";
import {
  ZActionNumberVariableCalculateOperator,
  ZActionTextVariableCalculateOperator,
  ZConditionGroup,
  ZDynamicLogicFieldValue,
} from "./logic";

export const ZSurveyBlockId = ZId;

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
