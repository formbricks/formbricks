import type { z } from "zod";
import { parseWorkflowVariablePath } from "../variables/paths";
import { isVariableEmailRecipient } from "./actions/send-email";
import { MAX_WORKFLOW_DATA_REF_FALLBACK_LENGTH, type TWorkflowDataRef } from "./common";
import {
  MAX_CONDITION_TEXT_LENGTH,
  type TWorkflowCondition,
  type TWorkflowConditionGroup,
  flattenWorkflowConditions,
} from "./conditions/base";
import {
  MAX_SWITCH_CASE_NAME_LENGTH,
  type TWorkflowSwitchNode,
  WORKFLOW_SWITCH_DEFAULT_BRANCH,
} from "./conditions/switch";
import type { TWorkflowDefinitionBase } from "./document";
import { WORKFLOW_LIMITS } from "./limits";

type TPath = (string | number)[];

const isDataRef = (value: unknown): value is TWorkflowDataRef =>
  typeof value === "object" && value !== null && !Array.isArray(value) && "path" in value;

const checkVariablePath = (variablePath: string, path: TPath, ctx: z.RefinementCtx): void => {
  const parsed = parseWorkflowVariablePath(variablePath);
  if (!parsed.ok) ctx.addIssue({ code: "custom", message: parsed.error, path });
};

const checkDataRef = (ref: TWorkflowDataRef, path: TPath, ctx: z.RefinementCtx): void => {
  checkVariablePath(ref.path, [...path, "path"], ctx);
  if (ref.fallback !== undefined && ref.fallback.length > MAX_WORKFLOW_DATA_REF_FALLBACK_LENGTH) {
    ctx.addIssue({
      code: "custom",
      message: `A Variable fallback can be at most ${MAX_WORKFLOW_DATA_REF_FALLBACK_LENGTH} characters`,
      path: [...path, "fallback"],
    });
  }
};

const checkConditionValue = (right: TWorkflowCondition["right"], path: TPath, ctx: z.RefinementCtx): void => {
  if (isDataRef(right)) checkDataRef(right, [...path, "right"], ctx);
  if (typeof right === "string" && right.length > MAX_CONDITION_TEXT_LENGTH) {
    ctx.addIssue({
      code: "custom",
      message: `A condition value can be at most ${MAX_CONDITION_TEXT_LENGTH} characters`,
      path: [...path, "right"],
    });
  }
};

const checkCondition = (condition: TWorkflowCondition, path: TPath, ctx: z.RefinementCtx): void => {
  checkDataRef(condition.left, [...path, "left"], ctx);
  checkConditionValue(condition.right, path, ctx);
};

const checkConditionGroup = (group: TWorkflowConditionGroup, path: TPath, ctx: z.RefinementCtx): void => {
  for (const [index, item] of group.conditions.entries()) {
    const itemPath = [...path, "conditions", index];
    if ("conditions" in item) checkConditionGroup(item, itemPath, ctx);
    else checkCondition(item, itemPath, ctx);
  }
};

const checkCaseCount = (count: number, path: TPath, ctx: z.RefinementCtx): void => {
  if (count < WORKFLOW_LIMITS.minSwitchCases) {
    ctx.addIssue({
      code: "custom",
      message: `A switch step needs at least ${WORKFLOW_LIMITS.minSwitchCases} cases`,
      path,
    });
  }
  if (count > WORKFLOW_LIMITS.maxSwitchCases) {
    ctx.addIssue({
      code: "custom",
      message: `A switch step can have at most ${WORKFLOW_LIMITS.maxSwitchCases} cases`,
      path,
    });
  }
};

/**
 * A Switch has 2–10 cases with unique ids other than `default` (each id is a branch's handle), names
 * within the cap, and the If/else Variable and value rules. A blank name may be saved while the
 * author types; enabling refuses it (`WORKFLOW_EXECUTABLE_NODE_CHECKS`).
 */
const checkSwitch = (node: TWorkflowSwitchNode, path: TPath, ctx: z.RefinementCtx): void => {
  const { cases, left } = node.config;
  checkCaseCount(cases.length, [...path, "cases"], ctx);
  checkDataRef(left, [...path, "left"], ctx);

  const ids = new Set<string>();
  for (const [index, switchCase] of cases.entries()) {
    const casePath = [...path, "cases", index];
    if (switchCase.id === WORKFLOW_SWITCH_DEFAULT_BRANCH) {
      ctx.addIssue({
        code: "custom",
        message: `The case id ${WORKFLOW_SWITCH_DEFAULT_BRANCH} is reserved for the Default branch`,
        path: [...casePath, "id"],
      });
    }
    if (ids.has(switchCase.id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate case id: ${switchCase.id}`,
        path: [...casePath, "id"],
      });
    }
    ids.add(switchCase.id);
    if (switchCase.name.length > MAX_SWITCH_CASE_NAME_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `A case name can be at most ${MAX_SWITCH_CASE_NAME_LENGTH} characters`,
        path: [...casePath, "name"],
      });
    }
    // The Variable is checked once above; a case adds only its value.
    checkConditionValue(switchCase.right, casePath, ctx);
  }
};

const checkSaveLimits = (definition: TWorkflowDefinitionBase, ctx: z.RefinementCtx): void => {
  if (definition.nodes.length > WORKFLOW_LIMITS.maxSteps) {
    ctx.addIssue({
      code: "custom",
      message: `A workflow can have at most ${WORKFLOW_LIMITS.maxSteps} steps`,
      path: ["nodes"],
    });
  }
};

/**
 * Rules a definition must meet when it is written (create, patch, duplicate) or enabled, but not when
 * a stored one is read or run: a definition saved before a rule existed must keep loading and running
 * (spec §10). Covers the save-time limits and the Variable path grammar.
 */
export const validateWorkflowDefinitionSaveRules = (
  definition: TWorkflowDefinitionBase,
  ctx: z.RefinementCtx
): void => {
  checkSaveLimits(definition, ctx);

  for (const [index, node] of definition.nodes.entries()) {
    const nodePath = ["nodes", index, "config"];
    if (node.type === "if_else") {
      const { condition } = node.config;
      if (flattenWorkflowConditions(condition).length > WORKFLOW_LIMITS.maxConditionsPerIfElse) {
        ctx.addIssue({
          code: "custom",
          message: `An if_else step can have at most ${WORKFLOW_LIMITS.maxConditionsPerIfElse} conditions`,
          path: [...nodePath, "condition"],
        });
      }
      checkConditionGroup(condition, [...nodePath, "condition"], ctx);
      continue;
    }
    if (node.type === "switch") {
      checkSwitch(node, nodePath, ctx);
      continue;
    }
    if (node.actionType === "send_email" && isVariableEmailRecipient(node.config.to)) {
      checkVariablePath(node.config.to.ref, [...nodePath, "to", "ref"], ctx);
    }
  }
};
