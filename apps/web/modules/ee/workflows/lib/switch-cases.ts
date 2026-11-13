import { type TWorkflowSwitchNode, WORKFLOW_LIMITS, toSwitchCaseCondition } from "@formbricks/workflows";
import {
  applyConditionEdit,
  isListOperator,
  isPresenceOperator,
} from "@/modules/ee/workflows/lib/if-else-conditions";
import type { TWorkflowVariableTypeHint } from "@/modules/ee/workflows/lib/variable-picker";
import { createSwitchCase } from "@/modules/ee/workflows/lib/workflow-steps";
import type { TGenericCondition } from "@/modules/ui/components/conditions-editor/types";

/**
 * The Switch panel (ENG-7157, mock screen 10): its case rows written back onto the node. A case is
 * an If/else condition on the Switch's Variable, so a row edit goes through the same mapping as an
 * If/else row (`applyConditionEdit`) and keeps the same value typing. Pure, so it is tested here.
 */

type TSwitchCase = TWorkflowSwitchNode["config"]["cases"][number];

const withCases = (node: TWorkflowSwitchNode, cases: TSwitchCase[]): TWorkflowSwitchNode => ({
  ...node,
  config: { ...node.config, cases },
});

/** Writes one row edit (operator or value, as the kit combobox reports it) onto a case. */
export const applySwitchCaseEdit = (
  node: TWorkflowSwitchNode,
  caseId: string,
  updates: Partial<TGenericCondition>,
  typeHintOf: (path: string) => TWorkflowVariableTypeHint | undefined
): TWorkflowSwitchNode =>
  withCases(
    node,
    node.config.cases.map((switchCase) => {
      if (switchCase.id !== caseId) return switchCase;
      const edited = applyConditionEdit(
        toSwitchCaseCondition(node.config.left, switchCase),
        updates,
        typeHintOf
      );
      // Leaving a presence check for a comparison: an empty value to type into, so the draft saves.
      const needsValue = !isPresenceOperator(edited.operator) && !isListOperator(edited.operator);
      const right = edited.right === undefined && needsValue ? "" : edited.right;
      return {
        id: switchCase.id,
        name: switchCase.name,
        operator: edited.operator,
        ...(right === undefined ? {} : { right }),
      };
    })
  );

export const canAddSwitchCase = (node: TWorkflowSwitchNode): boolean =>
  node.config.cases.length < WORKFLOW_LIMITS.maxSwitchCases;

export const canRemoveSwitchCase = (node: TWorkflowSwitchNode): boolean =>
  node.config.cases.length > WORKFLOW_LIMITS.minSwitchCases;

/** A new case after the last one; the node unchanged at the limit (spec: up to 10 cases). */
export const addSwitchCase = (node: TWorkflowSwitchNode, name: string): TWorkflowSwitchNode =>
  canAddSwitchCase(node) ? withCases(node, [...node.config.cases, createSwitchCase(name)]) : node;

/**
 * The node without that case; unchanged at two cases, the fewest a Switch saves with. Its branch
 * goes with it when the definition is updated (`withSwitchBranchesPruned`).
 */
export const removeSwitchCase = (node: TWorkflowSwitchNode, caseId: string): TWorkflowSwitchNode =>
  canRemoveSwitchCase(node)
    ? withCases(
        node,
        node.config.cases.filter((switchCase) => switchCase.id !== caseId)
      )
    : node;
