import { createId } from "@paralleldrive/cuid2";
import { type Node } from "@xyflow/react";
import { produce } from "immer";
import { atom } from "jotai";
import type { SetStateAction } from "react";
import { type TWorkflowDefinition, type TWorkflowResource, WORKFLOW_ACTIONS } from "@formbricks/workflows";

export type TWorkflowNodeCategory = "trigger" | "flow" | "action";
export type TWorkflowNodeIcon = "trigger" | "ifElse" | "email";

export type TWorkflowNodeData = {
  category: TWorkflowNodeCategory;
  icon: TWorkflowNodeIcon;
  title: string;
  summary: string;
  isLeaf: boolean;
  /** The node can't run as configured (e.g. no bound survey, missing email recipient/body). */
  isInvalid: boolean;
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

// Canvas starts locked so users land in a read-only view; the lock button in the toolbar
// flips it after we confirm the workflow status allows editing. A successful save also
// re-locks (see useWorkflowBuilder). NOTE: the lock only gates the canvas LAYOUT (drag +
// auto-layout). Node content edits and add/delete are gated by workflow status, not the lock.
export const isCanvasLockedAtom = atom<boolean>(true);

// Derived: the workflow's definition is editable when its status allows it (the API rejects
// definition PATCHes on enabled / archived workflows). The auth-derived `isReadOnly` flag is
// applied separately by the hook layer; this atom is the status check the canvas + inspector
// share for hiding/disabling structural controls.
export const canEditWorkflowDefinitionAtom = atom((get) => {
  const status = get(workflowEditorAtom).workflow?.status;
  return status === "draft" || status === "disabled";
});

// Combined gate for any interactive canvas affordance (add + delete + drag + auto-layout).
// Both the API-side status check AND the user-driven lock must allow it.
export const canMutateCanvasAtom = atom(
  (get) => get(canEditWorkflowDefinitionAtom) && !get(isCanvasLockedAtom)
);

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
      // Clicking a node opens the inspector even if the user previously collapsed it —
      // otherwise the config view stays hidden and the click looks broken.
      draft.isInspectorCollapsed = false;
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

// The canvas cog opens the workflow Settings view: it expands a collapsed inspector and switches
// an open node-config view back to Settings. It never collapses — that stays with the inspector
// toggle button next to it.
export const openWorkflowSettingsPanelAtom = atom(null, (get, set) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.isInspectorCollapsed = false;
      draft.isNodeConfigModalOpen = false;
    })
  );
});

// Drop a node + its incident edges; bridge each incoming edge to each outgoing one so the
// graph stays connected (preserving the incoming sourceHandle for if_else branches). Refuses
// to delete the trigger.
export const deleteWorkflowNodeAtom = atom(null, (get, set, nodeId: string) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      const definition = draft.definition;
      if (!definition) return;
      if (definition.trigger.id === nodeId) return;

      const incoming = definition.edges.filter((edge) => edge.target === nodeId);
      const outgoing = definition.edges.filter((edge) => edge.source === nodeId);

      definition.nodes = definition.nodes.filter((node) => node.id !== nodeId);
      definition.edges = definition.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);

      for (const inEdge of incoming) {
        for (const outEdge of outgoing) {
          definition.edges.push({
            id: createId(),
            source: inEdge.source,
            target: outEdge.target,
            ...(inEdge.sourceHandle ? { sourceHandle: inEdge.sourceHandle } : {}),
          });
        }
      }

      if (draft.selectedNodeId === nodeId) {
        draft.selectedNodeId = definition.trigger.id;
        draft.isNodeConfigModalOpen = false;
      }
    })
  );
});

// Append a fresh send_email node after `sourceNodeId` (used when the source has no outgoing
// edge yet — i.e. the user is starting the chain).
export const appendSendEmailAfterNodeAtom = atom(null, (get, set, sourceNodeId: string) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      const definition = draft.definition;
      if (!definition) return;

      const sourcePosition =
        definition.trigger.id === sourceNodeId
          ? definition.trigger.ui?.position
          : definition.nodes.find((node) => node.id === sourceNodeId)?.ui?.position;
      const newPosition = sourcePosition
        ? { x: sourcePosition.x, y: sourcePosition.y + 120 }
        : { x: 220, y: 200 };

      const newNodeId = createId();
      definition.nodes.push({
        id: newNodeId,
        type: "action",
        actionType: WORKFLOW_ACTIONS.SEND_EMAIL,
        label: "Send email",
        config: {
          to: "",
          from: "team@example.com",
          replyTo: [],
          subject: "",
          body: "",
          attachResponseData: false,
        },
        ui: { position: newPosition },
      });

      definition.edges.push({ id: createId(), source: sourceNodeId, target: newNodeId });

      draft.selectedNodeId = newNodeId;
      draft.isNodeConfigModalOpen = true;
    })
  );
});

// Split an existing edge with a fresh send_email node positioned between its endpoints.
export const insertSendEmailAfterEdgeAtom = atom(null, (get, set, edgeId: string) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      const definition = draft.definition;
      if (!definition) return;
      const edgeIndex = definition.edges.findIndex((edge) => edge.id === edgeId);
      if (edgeIndex < 0) return;
      const edge = definition.edges[edgeIndex];

      const positionOf = (nodeId: string) => {
        if (definition.trigger.id === nodeId) return definition.trigger.ui?.position;
        return definition.nodes.find((node) => node.id === nodeId)?.ui?.position;
      };
      const sourcePosition = positionOf(edge.source);
      const targetPosition = positionOf(edge.target);
      const midpoint =
        sourcePosition && targetPosition
          ? {
              x: Math.round((sourcePosition.x + targetPosition.x) / 2),
              y: Math.round((sourcePosition.y + targetPosition.y) / 2),
            }
          : { x: 220, y: 200 };

      const newNodeId = createId();
      definition.nodes.push({
        id: newNodeId,
        type: "action",
        actionType: WORKFLOW_ACTIONS.SEND_EMAIL,
        label: "Send email",
        config: {
          to: "",
          from: "team@example.com",
          replyTo: [],
          subject: "",
          body: "",
          attachResponseData: false,
        },
        ui: { position: midpoint },
      });

      definition.edges.splice(
        edgeIndex,
        1,
        {
          id: createId(),
          source: edge.source,
          target: newNodeId,
          ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
        },
        { id: createId(), source: newNodeId, target: edge.target }
      );

      draft.selectedNodeId = newNodeId;
      draft.isNodeConfigModalOpen = true;
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
