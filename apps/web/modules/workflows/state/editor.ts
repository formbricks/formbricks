"use client";

import { type Node } from "@xyflow/react";
import { produce } from "immer";
import { atom } from "jotai";
import type { SetStateAction } from "react";
import type { TWorkflowDefinition } from "@formbricks/types/workflows";
import type { TWorkflow } from "../types/workflows";

export type TWorkflowNodeData = {
  category: "trigger" | "flow" | "action";
  title: string;
  summary: string;
  icon: "trigger" | "ifElse" | "email" | "webhook";
};

type TWorkflowEditorState = {
  workflow: TWorkflow | null;
  workflowName: string;
  workflowDescription: string;
  definition: TWorkflowDefinition | null;
  flowNodes: Array<Node<TWorkflowNodeData>>;
  selectedNodeId: string | null;
  isConfigDrawerCollapsed: boolean;
  isSnapToCanvasEnabled: boolean;
};

const initialWorkflowEditorState: TWorkflowEditorState = {
  workflow: null,
  workflowName: "",
  workflowDescription: "",
  definition: null,
  flowNodes: [],
  selectedNodeId: null,
  isConfigDrawerCollapsed: false,
  isSnapToCanvasEnabled: true,
};

export const workflowEditorAtom = atom<TWorkflowEditorState>(initialWorkflowEditorState);

export const workflowAtom = atom((get) => get(workflowEditorAtom).workflow);
export const workflowNameAtom = atom((get) => get(workflowEditorAtom).workflowName);
export const workflowDescriptionAtom = atom((get) => get(workflowEditorAtom).workflowDescription);
export const workflowDefinitionAtom = atom((get) => get(workflowEditorAtom).definition);
export const workflowFlowNodesAtom = atom((get) => get(workflowEditorAtom).flowNodes);
export const selectedWorkflowNodeIdAtom = atom((get) => get(workflowEditorAtom).selectedNodeId);
export const isWorkflowConfigDrawerCollapsedAtom = atom(
  (get) => get(workflowEditorAtom).isConfigDrawerCollapsed
);
export const isWorkflowSnapToCanvasEnabledAtom = atom((get) => get(workflowEditorAtom).isSnapToCanvasEnabled);

export const hydrateWorkflowEditorAtom = atom(
  null,
  (
    _get,
    set,
    {
      workflow,
      flowNodes,
    }: {
      workflow: TWorkflow;
      flowNodes: Array<Node<TWorkflowNodeData>>;
    }
  ) => {
    set(
      workflowEditorAtom,
      produce(initialWorkflowEditorState, (draft) => {
        draft.workflow = workflow;
        draft.workflowName = workflow.name;
        draft.workflowDescription = workflow.description ?? "";
        draft.definition = workflow.definition;
        draft.flowNodes = flowNodes;
        draft.selectedNodeId = workflow.definition.trigger.id;
      })
    );
  }
);

export const setWorkflowAtom = atom(null, (get, set, workflow: TWorkflow) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.workflow = workflow;
      draft.workflowName = workflow.name;
      draft.workflowDescription = workflow.description ?? "";
    })
  );
});

export const setWorkflowNameAtom = atom(null, (get, set, workflowName: string) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.workflowName = workflowName;
    })
  );
});

export const setWorkflowDescriptionAtom = atom(null, (get, set, workflowDescription: string) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.workflowDescription = workflowDescription;
    })
  );
});

export const setWorkflowDefinitionAtom = atom(
  null,
  (get, set, update: SetStateAction<TWorkflowDefinition | null>) => {
    const currentState = get(workflowEditorAtom);
    const nextDefinition = typeof update === "function" ? update(currentState.definition) : update;

    set(
      workflowEditorAtom,
      produce(currentState, (draft) => {
        draft.definition = nextDefinition;
      })
    );
  }
);

export const setWorkflowFlowNodesAtom = atom(
  null,
  (get, set, update: SetStateAction<Array<Node<TWorkflowNodeData>>>) => {
    const currentState = get(workflowEditorAtom);
    const nextFlowNodes = typeof update === "function" ? update(currentState.flowNodes) : update;

    set(
      workflowEditorAtom,
      produce(currentState, (draft) => {
        draft.flowNodes = nextFlowNodes;
      })
    );
  }
);

export const setSelectedWorkflowNodeIdAtom = atom(null, (get, set, selectedNodeId: string | null) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.selectedNodeId = selectedNodeId;
    })
  );
});

export const toggleWorkflowConfigDrawerAtom = atom(null, (get, set) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.isConfigDrawerCollapsed = !draft.isConfigDrawerCollapsed;
    })
  );
});

export const setWorkflowSnapToCanvasEnabledAtom = atom(null, (get, set, isSnapToCanvasEnabled: boolean) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.isSnapToCanvasEnabled = isSnapToCanvasEnabled;
    })
  );
});
