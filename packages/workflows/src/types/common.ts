import { z } from "zod";
import { MAX_WORKFLOW_VARIABLE_PATH_LENGTH } from "../variables/paths";
import { MAX_WORKFLOW_NODE_ID_LENGTH } from "./node-ids";

export const ZWorkflowStatus = z
  .enum(["draft", "enabled", "disabled", "archived"])
  .describe(
    "Lifecycle state of a workflow. Archived workflows are soft-deleted and excluded from default reads."
  );
export type TWorkflowStatus = z.infer<typeof ZWorkflowStatus>;

export const ZWorkflowNodeType = z.enum(["action", "if_else", "filter", "switch", "trigger"]);
export type TWorkflowNodeType = z.infer<typeof ZWorkflowNodeType>;

export const ZWorkflowChildNodeType = z.enum(["action", "if_else", "filter", "switch"]);
export type TWorkflowChildNodeType = z.infer<typeof ZWorkflowChildNodeType>;

export const ZWorkflowNodePosition = z.object({
  x: z.number(),
  y: z.number(),
});
export type TWorkflowNodePosition = z.infer<typeof ZWorkflowNodePosition>;

export const ZWorkflowNodeUi = z
  .object({
    position: ZWorkflowNodePosition.optional(),
    collapsed: z.boolean().optional(),
  })
  .catchall(z.unknown())
  .describe("Builder-only UI metadata that does not affect workflow execution.");
export type TWorkflowNodeUi = z.infer<typeof ZWorkflowNodeUi>;

export const ZWorkflowCanvasDirection = z
  .enum(["vertical", "horizontal"])
  .describe("Which way the builder's canvas reads: top to bottom (the default) or left to right.");
export type TWorkflowCanvasDirection = z.infer<typeof ZWorkflowCanvasDirection>;

export const ZWorkflowDefinitionUi = z
  .object({
    direction: ZWorkflowCanvasDirection.optional(),
  })
  .catchall(z.unknown())
  .describe("Builder-only UI metadata for the whole workflow that does not affect execution.");
export type TWorkflowDefinitionUi = z.infer<typeof ZWorkflowDefinitionUi>;

/** Longest fallback text a Variable reference may carry; checked on save (`ZWorkflowDefinitionInput`). */
export const MAX_WORKFLOW_DATA_REF_FALLBACK_LENGTH = 1000;

/**
 * The path grammar and the fallback cap are checked on save and enable, not here: this schema also
 * reads stored definitions, and a draft saved before the rule could hold any path.
 */
export const ZWorkflowDataRef = z
  .object({
    path: z
      .string()
      .min(1)
      .describe(
        `Variable path in the run context: payload.<path>, steps.<stepId>.status, steps.<stepId>.body.<path> or response.<questionId>, at most ${MAX_WORKFLOW_VARIABLE_PATH_LENGTH} characters. Segments __proto__, prototype and constructor are refused.`
      ),
    fallback: z
      .string()
      .optional()
      .describe(
        `Fallback string used when the referenced path is missing, at most ${MAX_WORKFLOW_DATA_REF_FALLBACK_LENGTH} characters.`
      ),
  })
  .describe("Reference to a workflow Variable used by conditions or actions.");

export type TWorkflowDataRef = z.infer<typeof ZWorkflowDataRef>;

/**
 * The id grammar and reserved names are checked on save and enable (`getWorkflowNodeIdProblem`), not
 * here: this schema also reads stored definitions, and one saved before the rule could hold any id.
 */
export const ZWorkflowNodeBase = z.object({
  id: z
    .string()
    .min(1)
    .describe(
      `Node id, unique in the definition: letters, digits, _ and - only, at most ${MAX_WORKFLOW_NODE_ID_LENGTH} characters. A step's id can't be trigger, start with trigger_, or be __proto__, prototype or constructor.`
    ),
  type: ZWorkflowNodeType,
  label: z.string().min(1).max(120).optional(),
  ui: ZWorkflowNodeUi.optional(),
});
