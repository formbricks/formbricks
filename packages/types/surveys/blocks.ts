import { z } from "zod";
import { ZId } from "../common";
import { ZI18nString } from "../i18n";
import { ZSurveyElementId, ZSurveyElements } from "./elements";
import { ZExpressionValue } from "./expressions";
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
        .string({
          error: "Conditional Logic: Value must be a string for text variable",
        })
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
      value: z.number({
        error: "Conditional Logic: Value must be a number for number variable",
      }),
    }),
    ZDynamicLogicFieldValue,
  ]),
}).superRefine((val, ctx) => {
  if (val.operator === "divide" && val.value.type === "static" && val.value.value === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Conditional Logic: Cannot divide by zero",
      path: ["value", "value"],
    });
  }
});

/**
 * Set value (ENG-6935, ADR 0025): assigns the result of an expression tree (ADR 0024) to a computed
 * field of any computed type. A third member of the union, so the one-step operators above keep
 * today's behaviour ("empty counts as 0") and this one has its own ("empty in, empty out").
 */
export const ZActionCalculateExpression = ZActionCalculateBase.extend({
  operator: z.literal("assign"),
  value: ZExpressionValue,
});

export type TActionCalculateExpression = z.infer<typeof ZActionCalculateExpression>;

export const ZActionCalculate = z.union([
  ZActionCalculateText,
  ZActionCalculateNumber,
  ZActionCalculateExpression,
]);

export type TActionCalculate = z.infer<typeof ZActionCalculate>;

export type TSurveyBlockLogicActionObjective =
  | "calculate"
  | "requireAnswer"
  | "jumpToBlock"
  | "markLowQuality";

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
          code: "custom",
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
          code: "custom",
          message: "Conditional Logic: Target block id is not a valid block id",
        });
      }
    }),
});

export type TActionJumpToBlock = z.infer<typeof ZActionJumpToBlock>;

// MarkLowQuality action (ENG-6933, ADR 0022/0023): when the rule fires, the survey asks the server to
// mark the response Low quality with its next create or update (`markLowQuality: true`). The respondent
// sees nothing. It takes no target, and is refused in the rules before the first question.

export const ZActionMarkLowQuality = z.object({
  id: ZId,
  objective: z.literal("markLowQuality"),
});

export type TActionMarkLowQuality = z.infer<typeof ZActionMarkLowQuality>;

// Block logic actions

export const ZSurveyBlockLogicAction = z.union([
  ZActionCalculate,
  ZActionRequireAnswer,
  ZActionJumpToBlock,
  ZActionMarkLowQuality,
]);

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
    name: z.string().min(1, {
      error: "Block name is required",
    }), // REQUIRED for editor
    elements: ZSurveyElements.min(1, {
      error: "Block must have at least one element",
    }),
    logic: z.array(ZSurveyBlockLogic).optional(),
    logicFallback: ZSurveyBlockId.optional(),
    /**
     * Show-if (ENG-6931): the block is shown only when this condition group matches. A block whose
     * show-if fails is skipped, and its logic still runs as if it were submitted with no answers. It
     * may use earlier blocks only. Absent, or an empty group, means always shown.
     */
    showIf: ZConditionGroup.optional(),
    buttonLabel: ZI18nString.optional(),
    backButtonLabel: ZI18nString.optional(),
  })
  .superRefine((block, ctx) => {
    // Validate element IDs are unique within block
    const elementIds = block.elements.map((e) => e.id);
    const uniqueElementIds = new Set(elementIds);
    if (uniqueElementIds.size !== elementIds.length) {
      ctx.addIssue({
        code: "custom",
        message: "Element IDs must be unique within a block",
        path: [elementIds.findIndex((id, index) => elementIds.indexOf(id) !== index), "id"],
      });
    }
  });

export type TSurveyBlock = z.infer<typeof ZSurveyBlock>;

export const ZSurveyBlocks = z.array(ZSurveyBlock);
export type TSurveyBlocks = z.infer<typeof ZSurveyBlocks>;
