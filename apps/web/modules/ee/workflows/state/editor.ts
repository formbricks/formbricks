import { createId } from "@paralleldrive/cuid2";
import { type Node } from "@xyflow/react";
import { produce } from "immer";
import { atom } from "jotai";
import type { SetStateAction } from "react";
import {
  type TWorkflowDefinition,
  type TWorkflowResource,
  type TWorkflowTriggerType,
  WORKFLOW_ACTIONS,
  WORKFLOW_TRIGGERS,
  ZWorkflowExecutableDefinition,
} from "@formbricks/workflows";

export type TWorkflowNodeCategory = "trigger" | "flow" | "action";
export type TWorkflowNodeIcon = "trigger" | "ifElse" | "email";

export type TWorkflowNodeIssue = {
  /**
   * "setup" = a draft that simply isn't finished being configured (amber, guiding);
   * "error" = a live (or previously live) workflow that can't run as configured (red).
   */
  severity: "setup" | "error";
  /** Short user-facing reason rendered on the card in place of the summary. */
  label: string;
};

export type TWorkflowNodeData = {
  category: TWorkflowNodeCategory;
  icon: TWorkflowNodeIcon;
  title: string;
  summary: string;
  isLeaf: boolean;
  issue: TWorkflowNodeIssue | null;
};

/**
 * The editable draft fields exactly as last persisted (or hydrated). Compared against the live
 * draft to derive dirtiness; kept as a client-side snapshot of what was SENT (not the server
 * response) so server-side normalization can never make the editor look permanently dirty.
 */
export type TWorkflowSavedDraft = {
  workflowName: string;
  workflowDescription: string;
  definition: TWorkflowDefinition | null;
};

type TWorkflowEditorState = {
  workflow: TWorkflowResource | null;
  workflowName: string;
  workflowDescription: string;
  definition: TWorkflowDefinition | null;
  lastSavedDraft: TWorkflowSavedDraft | null;
  /** Epoch ms of the last successful save this session; drives the "Changes saved" flash. */
  lastSavedAt: number | null;
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
  lastSavedDraft: null,
  lastSavedAt: null,
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
export const selectedWorkflowNodeIdAtom = atom((get) => get(workflowEditorAtom).selectedNodeId);

// ReactFlow's nodes live OUTSIDE the immer-produced editor state on purpose: immer auto-freezes
// everything it produces, and ReactFlow mutates node internals (measured width/height) inside
// applyNodeChanges — on frozen nodes that throws "Cannot assign to read only property 'width'".
// A plain base atom keeps them mutable; jotai's setter already supports functional updates.
export const workflowFlowNodesAtom = atom<Array<Node<TWorkflowNodeData>>>([]);
export const isWorkflowInspectorCollapsedAtom = atom((get) => get(workflowEditorAtom).isInspectorCollapsed);
export const isWorkflowSnapToCanvasEnabledAtom = atom((get) => get(workflowEditorAtom).isSnapToCanvasEnabled);
export const isWorkflowNodeConfigModalOpenAtom = atom((get) => get(workflowEditorAtom).isNodeConfigModalOpen);
export const isWorkflowSavingAtom = atom((get) => get(workflowEditorAtom).isSaving);
export const isWorkflowTransitioningAtom = atom((get) => get(workflowEditorAtom).isTransitioning);

// Whether the trigger's surveyId resolves to a real survey. Owned by the builder page, which is
// the only place holding the server-resolved email authoring context; defaults to true so nothing
// flashes as broken before the page syncs it.
export const hasBoundTriggerSurveyAtom = atom<boolean>(true);

const toSavedDraft = (state: TWorkflowEditorState): TWorkflowSavedDraft => ({
  workflowName: state.workflowName.trim(),
  workflowDescription: state.workflowDescription.trim(),
  definition: state.definition,
});

// Records the just-persisted draft. The save flow passes the exact values it sent (captured
// before the request) so edits landing while the PATCH was in flight still read as dirty.
export const markWorkflowDraftSavedAtom = atom(null, (get, set, savedDraft: TWorkflowSavedDraft) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.lastSavedDraft = savedDraft;
      draft.lastSavedAt = Date.now();
    })
  );
});

export const workflowLastSavedAtAtom = atom((get) => get(workflowEditorAtom).lastSavedAt);

// True while the editable draft (name, description, definition) differs from what was last
// persisted. Trimmed comparison so trailing whitespace the save flow strips anyway never counts.
export const isWorkflowDirtyAtom = atom((get) => {
  const state = get(workflowEditorAtom);
  if (!state.workflow || !state.lastSavedDraft) return false;
  const current = toSavedDraft(state);
  return (
    current.workflowName !== state.lastSavedDraft.workflowName ||
    current.workflowDescription !== state.lastSavedDraft.workflowDescription ||
    JSON.stringify(current.definition) !== JSON.stringify(state.lastSavedDraft.definition)
  );
});

export type TWorkflowValidity = {
  /** The workflow has a non-empty name (required by the PATCH contract). */
  isNameValid: boolean;
  /** The definition passes the same executable-subset schema enable/test enforce server-side. */
  isDefinitionExecutable: boolean;
  /** The trigger's surveyId resolves to a real survey (see hasBoundTriggerSurveyAtom). */
  hasBoundTriggerSurvey: boolean;
  /** Everything above holds; the workflow would pass the server's enable/test pre-flight. */
  isReady: boolean;
};

// Live whole-workflow validity, recomputed on every draft edit. Mirrors the server's enable/test
// checks (ZWorkflowExecutableDefinition plus the survey binding) so the editor can flag an
// unready workflow immediately instead of after a round-trip.
export const workflowValidityAtom = atom<TWorkflowValidity>((get) => {
  const state = get(workflowEditorAtom);
  const hasBoundTriggerSurvey = get(hasBoundTriggerSurveyAtom);
  const isNameValid = state.workflowName.trim().length > 0;
  const isDefinitionExecutable = state.definition
    ? ZWorkflowExecutableDefinition.safeParse(state.definition).success
    : false;

  return {
    isNameValid,
    isDefinitionExecutable,
    hasBoundTriggerSurvey,
    isReady: isNameValid && isDefinitionExecutable && hasBoundTriggerSurvey,
  };
});

// Locked = pan mode (pan/browse; nodes are inert), unlocked = pointer mode (select/inspect,
// edit when status/permissions allow). Pointer is the default tool and the toggle is purely
// user-driven — nothing auto-switches it; mutations are gated separately by canMutateCanvasAtom.
export const isCanvasLockedAtom = atom<boolean>(false);

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
    // Optimistic default until the builder page re-syncs it from the authoring context;
    // without the reset, a previous workflow's "unbound" state would flash on the next one.
    set(hasBoundTriggerSurveyAtom, true);
    // Set outside the produce below so the nodes stay unfrozen (see workflowFlowNodesAtom).
    set(workflowFlowNodesAtom, flowNodes);
    set(
      workflowEditorAtom,
      produce(initialWorkflowEditorState, (draft) => {
        draft.workflow = workflow;
        draft.workflowName = workflow.name;
        draft.workflowDescription = workflow.description ?? "";
        draft.definition = workflow.definition;
        // Freshly hydrated means nothing is dirty yet; the saved snapshot is the loaded state.
        draft.lastSavedDraft = {
          workflowName: workflow.name.trim(),
          workflowDescription: (workflow.description ?? "").trim(),
          definition: workflow.definition,
        };
        draft.selectedNodeId = workflow.definition.trigger?.id ?? null;
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

// Drop a node + its incident edges; bridge each incoming edge to each outgoing one so the
// graph stays connected (preserving the incoming sourceHandle for if_else branches). Refuses
// to delete the trigger.
export const deleteWorkflowNodeAtom = atom(null, (get, set, nodeId: string) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      const definition = draft.definition;
      if (!definition) return;
      if (definition.trigger?.id === nodeId) return;

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
        draft.selectedNodeId = definition.trigger?.id ?? null;
        draft.isNodeConfigModalOpen = false;
      }
    })
  );
});

// Seed the trigger on an empty draft canvas (the "Add trigger" picker). The placeholder
// surveyId keeps the config schema-valid until the user binds a real survey; opening the
// config panel right away walks them into doing exactly that.
export const addWorkflowTriggerAtom = atom(null, (get, set, triggerType: TWorkflowTriggerType) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      const definition = draft.definition;
      if (!definition || definition.trigger) return;
      if (triggerType !== WORKFLOW_TRIGGERS.RESPONSE_COMPLETED) return;

      const triggerId = createId();
      definition.trigger = {
        id: triggerId,
        type: "trigger",
        triggerType,
        config: {
          surveyId: createId(),
          endingCardIds: [],
        },
        // Matches WORKFLOW_CANVAS_START_POSITION in definition-to-flow (not imported to avoid a cycle).
        ui: { position: { x: 220, y: 80 } },
      };
      definition.entryNodeId = triggerId;

      draft.selectedNodeId = triggerId;
      draft.isNodeConfigModalOpen = true;
    })
  );
});

// Fallback canvas position when the reference node/edge carries no stored position.
const SEND_EMAIL_FALLBACK_POSITION = { x: 220, y: 200 };

// The default send_email node both insertion atoms create (append-after-node and split-edge).
// The position is cloned so no two nodes ever share one mutable position object.
const createDefaultSendEmailNode = (position: {
  x: number;
  y: number;
}): TWorkflowDefinition["nodes"][number] => ({
  id: createId(),
  type: "action",
  actionType: WORKFLOW_ACTIONS.SEND_EMAIL,
  // No hardcoded label: the node title falls back to the translated
  // `workspace.workflows.send_email` key (see node-registry). A label is only set when the
  // user renames the node, so the default stays localized.
  config: {
    to: "",
    from: "team@example.com",
    replyTo: [],
    subject: "",
    body: "",
    attachResponseData: false,
  },
  ui: { position: { ...position } },
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
        definition.trigger?.id === sourceNodeId
          ? definition.trigger.ui?.position
          : definition.nodes.find((node) => node.id === sourceNodeId)?.ui?.position;
      const newPosition = sourcePosition
        ? { x: sourcePosition.x, y: sourcePosition.y + 120 }
        : SEND_EMAIL_FALLBACK_POSITION;

      const newNode = createDefaultSendEmailNode(newPosition);
      definition.nodes.push(newNode);

      definition.edges.push({ id: createId(), source: sourceNodeId, target: newNode.id });

      draft.selectedNodeId = newNode.id;
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
        if (definition.trigger?.id === nodeId) return definition.trigger.ui?.position;
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
          : SEND_EMAIL_FALLBACK_POSITION;

      const newNode = createDefaultSendEmailNode(midpoint);
      definition.nodes.push(newNode);

      definition.edges.splice(
        edgeIndex,
        1,
        {
          id: createId(),
          source: edge.source,
          target: newNode.id,
          ...(edge.sourceHandle ? { sourceHandle: edge.sourceHandle } : {}),
        },
        { id: createId(), source: newNode.id, target: edge.target }
      );

      draft.selectedNodeId = newNode.id;
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
