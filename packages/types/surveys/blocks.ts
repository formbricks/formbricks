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

export type TSurveyBlockLogicActionObjective = "calculate" | "requireAnswer" | "jumpToBlock";

// RequireAnswer action - targets element IDs

export const ZActionRequireAnswer = z.object({
  id: ZId,
  objective: z.literal("requireAnswer"),
  target: z
    .string()
    .min(1, "Conditional Logic: Target question id cannot be empty")
    .superRefine((id, ctx) => {
      const idParsed = ZSurveyElementId.safeParse(id);
      if (!idParsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          // This is not possible from the UI hence we can use the term "element" instead of "question"
          message: "Conditional Logic: Target element id is not a valid element id",
          path: ["target"],
        });
      }
    }),
});

export type TActionRequireAnswer = z.infer<typeof ZActionRequireAnswer>;

// JumpToBlock action - targets block IDs (CUIDs)

export const ZActionJumpToBlock = z.object({
  id: ZId,
  objective: z.literal("jumpToBlock"),
  target: z
    .string()
    .min(1, "Conditional Logic: Target block id cannot be empty")
    .superRefine((id, ctx) => {
      const idParsed = ZSurveyBlockId.safeParse(id);
      if (!idParsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conditional Logic: Target block id is not a valid block id",
        });
      }
    }),
});

export type TActionJumpToBlock = z.infer<typeof ZActionJumpToBlock>;

// Block logic actions

export const ZSurveyBlockLogicAction = z.union([ZActionCalculate, ZActionRequireAnswer, ZActionJumpToBlock]);

export type TSurveyBlockLogicAction = z.infer<typeof ZSurveyBlockLogicAction>;

// Block Logic

export const ZSurveyBlockLogic = z.object({
  id: ZId,
  conditions: ZConditionGroup,
  actions: z.array(ZSurveyBlockLogicAction),
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
