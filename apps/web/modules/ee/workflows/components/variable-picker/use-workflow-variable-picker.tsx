"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { WorkflowVariablePicker } from "@/modules/ee/workflows/components/variable-picker/workflow-variable-picker";
import { useWorkflowVariableGroups } from "@/modules/ee/workflows/hooks/use-workflow-variable-groups";
import type { TJsonEditorVariable } from "@/modules/ee/workflows/lib/json-editor";
import {
  type TWorkflowStepVariableContext,
  type TWorkflowVariableGroup,
  getWorkflowVariableLabel,
  getWorkflowVariableRecallItems,
} from "@/modules/ee/workflows/lib/variable-picker";
import { openWorkflowNodeConfigModalAtom, workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";
import type { TEditorRecallSource } from "@/modules/ui/components/editor/components/recall-source";

/**
 * A field's ask for a Variable. The same shape as the JsonEditor's `onRequestVariable` request, so
 * `onRequestVariable={picker.requestVariable}` works as is; a plain input builds one from its caret.
 */
export interface TWorkflowVariableRequest {
  /** Viewport position to open at; null opens at the top left of the viewport. */
  anchorRect: { left: number; top: number; bottom: number } | null;
  /** Writes the picked Variable into the field (as a `#recall:<path>/fallback:#` token, or otherwise). */
  insert: (variable: TJsonEditorVariable) => void;
  /** Closed without a pick. */
  dismiss: () => void;
}

export interface TWorkflowVariablePicker {
  groups: TWorkflowVariableGroup[];
  /** Opens the picker for a field; the field's `insert` or `dismiss` is called once when it closes. */
  requestVariable: (request: TWorkflowVariableRequest) => void;
  /** Render this once next to the fields that call `requestVariable`. */
  pickerElement: ReactNode;
  /** For the kit `Editor`'s `recallSource`: Variable chips and this picker on `@`. */
  recallSource: TEditorRecallSource;
}

/**
 * The Variable picker (ENG-7113) for the fields of one step: the groups that step can use and three
 * ways to plug them into a field — `requestVariable` for the JsonEditor and plain inputs, and
 * `recallSource` for the kit Editor (an email body).
 */
export const useWorkflowVariablePicker = ({
  nodeId,
  stepContext,
}: {
  nodeId: string;
  stepContext?: TWorkflowStepVariableContext;
}): TWorkflowVariablePicker => {
  const groups = useWorkflowVariableGroups(nodeId, stepContext);
  const triggerId = useAtomValue(workflowDefinitionAtom)?.trigger?.id ?? null;
  const openNodeConfigModal = useSetAtom(openWorkflowNodeConfigModalAtom);
  const [request, setRequest] = useState<TWorkflowVariableRequest | null>(null);

  const openTrigger = useMemo(
    () => (triggerId ? () => openNodeConfigModal(triggerId) : undefined),
    [triggerId, openNodeConfigModal]
  );

  const requestVariable = useCallback((next: TWorkflowVariableRequest) => setRequest(next), []);

  const pickerElement = request ? (
    <WorkflowVariablePicker
      groups={groups}
      anchorRect={request.anchorRect ?? { left: 0, top: 0, bottom: 0 }}
      onSelect={(option) => {
        setRequest(null);
        request.insert({ path: option.path });
      }}
      onClose={() => {
        setRequest(null);
        request.dismiss();
      }}
      onOpenTrigger={
        openTrigger &&
        (() => {
          setRequest(null);
          request.dismiss();
          openTrigger();
        })
      }
    />
  ) : null;

  const recallSource = useMemo<TEditorRecallSource>(
    () => ({
      getRecallItems: (text) => getWorkflowVariableRecallItems(text, groups),
      getRecallItemLabel: (id) => getWorkflowVariableLabel(groups, id),
      renderPicker: ({ recallItems, addRecallItem, setShowRecallItemSelect }) => (
        <WorkflowVariablePicker
          groups={groups}
          excludedPaths={recallItems.map((item) => item.id)}
          onSelect={(option) => addRecallItem({ id: option.path, label: option.label, type: "variable" })}
          onClose={() => setShowRecallItemSelect(false)}
          onOpenTrigger={
            openTrigger &&
            (() => {
              setShowRecallItemSelect(false);
              openTrigger();
            })
          }
        />
      ),
    }),
    [groups, openTrigger]
  );

  return { groups, requestVariable, pickerElement, recallSource };
};
