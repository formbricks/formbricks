import { type Node } from "@xyflow/react";
import { produce } from "immer";
import { atom } from "jotai";
import type { SetStateAction } from "react";
import type { TWorkflowDefinition, TWorkflowResource } from "@formbricks/workflows";
import type { TWorkflowSurveyChoice } from "@/modules/workflows/types";

export type TWorkflowNodeCategory = "trigger" | "flow" | "action";
export type TWorkflowNodeIcon = "trigger" | "ifElse" | "email";

export type TWorkflowNodeData = {
  category: TWorkflowNodeCategory;
  icon: TWorkflowNodeIcon;
  title: string;
  summary: string;
};

type TWorkflowEditorState = {
  workflow: TWorkflowResource | null;
  workflowName: string;
  workflowDescription: string;
  definition: TWorkflowDefinition | null;
  flowNodes: Array<Node<TWorkflowNodeData>>;
  selectedNodeId: string | null;
  isInspectorCollapsed: boolean;
  isSnapToCanvasEnabled: boolean;
  isNodeConfigModalOpen: boolean;
  isSaving: boolean;
  isTransitioning: boolean;
};

const initialWorkflowEditorState: TWorkflowEditorState = {
  workflow: null,
  workflowName: "",
  workflowDescription: "",
  definition: null,
  flowNodes: [],
  selectedNodeId: null,
  isInspectorCollapsed: false,
  isSnapToCanvasEnabled: true,
  isNodeConfigModalOpen: false,
  isSaving: false,
  isTransitioning: false,
};

export const workflowEditorAtom = atom<TWorkflowEditorState>(initialWorkflowEditorState);

export const workflowAtom = atom((get) => get(workflowEditorAtom).workflow);
export const workflowNameAtom = atom((get) => get(workflowEditorAtom).workflowName);
export const workflowDescriptionAtom = atom((get) => get(workflowEditorAtom).workflowDescription);
export const workflowDefinitionAtom = atom((get) => get(workflowEditorAtom).definition);
export const workflowFlowNodesAtom = atom((get) => get(workflowEditorAtom).flowNodes);
export const selectedWorkflowNodeIdAtom = atom((get) => get(workflowEditorAtom).selectedNodeId);
export const isWorkflowInspectorCollapsedAtom = atom((get) => get(workflowEditorAtom).isInspectorCollapsed);
export const isWorkflowSnapToCanvasEnabledAtom = atom((get) => get(workflowEditorAtom).isSnapToCanvasEnabled);
export const isWorkflowNodeConfigModalOpenAtom = atom((get) => get(workflowEditorAtom).isNodeConfigModalOpen);
export const isWorkflowSavingAtom = atom((get) => get(workflowEditorAtom).isSaving);
export const isWorkflowTransitioningAtom = atom((get) => get(workflowEditorAtom).isTransitioning);

// Primitive (not derived) so it can be hydrated synchronously via jotai/utils' useHydrateAtoms.
export const surveyChoicesAtom = atom<TWorkflowSurveyChoice[]>([]);

// Canvas starts locked so users land in a read-only view; the lock button in the toolbar
// flips it after we confirm the workflow status allows editing. A successful save also
// re-locks (see useWorkflowBuilder).
export const isCanvasLockedAtom = atom<boolean>(true);

export const setWorkflowSavingAtom = atom(null, (get, set, isSaving: boolean) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.isSaving = isSaving;
    })
  );
});

export const setWorkflowTransitioningAtom = atom(null, (get, set, isTransitioning: boolean) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.isTransitioning = isTransitioning;
    })
  );
});

export const hydrateWorkflowEditorAtom = atom(
  null,
  (
    _get,
    set,
    {
      workflow,
      flowNodes,
    }: {
      workflow: TWorkflowResource;
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

// Updates the server-owned workflow snapshot only; leaves the editable draft fields
// (workflowName, workflowDescription, definition) intact so unsaved edits aren't wiped
// out by save responses or lifecycle transitions that race with the user's typing.
export const setWorkflowAtom = atom(null, (get, set, workflow: TWorkflowResource) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.workflow = workflow;
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

export const openWorkflowNodeConfigModalAtom = atom(null, (get, set, nodeId: string) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.selectedNodeId = nodeId;
      draft.isNodeConfigModalOpen = true;
    })
  );
});

export const closeWorkflowNodeConfigModalAtom = atom(null, (get, set) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.isNodeConfigModalOpen = false;
    })
  );
});

export const toggleWorkflowInspectorAtom = atom(null, (get, set) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.isInspectorCollapsed = !draft.isInspectorCollapsed;
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
