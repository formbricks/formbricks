import { createId } from "@paralleldrive/cuid2";
import { type Node } from "@xyflow/react";
import { produce } from "immer";
import { atom } from "jotai";
import type { SetStateAction } from "react";
import {
  type TWorkflowDefinition,
  type TWorkflowResource,
  type TWorkflowTriggerType,
  WORKFLOW_LIMITS,
  ZWorkflowEnableDefinition,
  getBlankSendEmailContentFields,
  isResponseCompletedTrigger,
} from "@formbricks/workflows";
import {
  type TWorkflowCanvasDirection,
  getAppendedStepPosition,
  getCanvasDirection,
} from "@/modules/ee/workflows/lib/canvas-geometry";
import { createDefaultTrigger } from "@/modules/ee/workflows/lib/default-workflow";
import { hasUnplacedSurveyLink } from "@/modules/ee/workflows/lib/email-survey-link";
import {
  settleSentSecretValues,
  settleUnstoredSecrets,
  withSecretIdsForCheck,
} from "@/modules/ee/workflows/lib/http-request-panel";
import {
  type TPasteTarget,
  type TStepClipboard,
  canPasteAt,
  captureStepCopy,
  getStepAndAfter,
  pasteSteps,
} from "@/modules/ee/workflows/lib/step-clipboard";
import { type TMoveStepResult, moveStep } from "@/modules/ee/workflows/lib/step-move";
import {
  type TAddableWorkflowStepType,
  createDefaultWorkflowStep,
  getBranchHandles,
  getBranchLegOffset,
  isBranchingStep,
  removeBranchingStepWithBranches,
} from "@/modules/ee/workflows/lib/workflow-steps";
import type { TFlowTextPart } from "@/modules/survey/editor/lib/reference-chips";

export { countStepsOnBranches } from "@/modules/ee/workflows/lib/workflow-steps";

export type TWorkflowNodeCategory = "trigger" | "flow" | "action";
export type TWorkflowNodeIcon = "survey" | "webhook" | "ifElse" | "filter" | "switch" | "email" | "http";

export type TWorkflowNodeIssue = {
  /**
   * "setup" = a draft that simply isn't finished being configured (amber, guiding);
   * "error" = a live (or previously live) workflow that can't run as configured (red).
   */
  severity: "setup" | "error";
  /** Short user-facing reason rendered on the card in place of the summary. */
  label: string;
};

/** One leg of a branching step's fork on the canvas. */
export type TWorkflowCanvasBranch = {
  /** The edges' `sourceHandle`: `then`/`else`, a Switch case id, or `default`. */
  handle: string;
  /** The plain label at the start of the leg (no icons, ED8). */
  label: string;
  ariaLabel: string;
  /** The accessible name of the leg's `+` while the branch has no step. */
  addStepLabel: string;
};

export type TWorkflowNodeData = {
  category: TWorkflowNodeCategory;
  icon: TWorkflowNodeIcon;
  /** Concrete type for analytics (`response.completed`, `send_email`, `if_else`, `switch`), never shown. */
  nodeType: string;
  title: string;
  summary: string;
  /**
   * The summary as a sentence with chips (If/else and Switch), drawn like the survey flow editor's
   * rules; `summary` stays the plain text for tooltips and screen readers.
   */
  summaryParts?: TFlowTextPart[] | null;
  /**
   * Shows the inline `+` under the card: a trigger with no step yet, or the last step of an If/else
   * branch. Other steps don't offer it while a workflow outside branches is capped at one action.
   */
  canAppendStep: boolean;
  /**
   * If/else and Switch only: every branch, left to right, as its leg of the fork shows it (Then and
   * Else, or each case and Default). Empty for any other step.
   */
  branches: TWorkflowCanvasBranch[];
  /** The branches (handles) with no step yet, which end in their own `+` under the fork. */
  emptyBranches: string[];
  /**
   * Each branch's leg under the fork, as an x offset from the step's centre, in `branches` order. Set
   * by the canvas from where the branches' steps are (withBranchLegOffsets).
   */
  legOffsets?: number[];
  issue: TWorkflowNodeIssue | null;
  /**
   * Only on the Runs view's read-only canvas: what the shown run did at this step ("Succeeded",
   * "Not taken"…), drawn above the card (review point 1).
   */
  runBadge?: TWorkflowNodeRunBadge;
};

export type TWorkflowNodeRunBadge = { label: string; type: "success" | "error" | "warning" | "gray" };

/**
 * A pending "take me to the field that's wrong" jump, raised by the validation problems dialog and
 * consumed by whichever config form owns `nodeId`. The form focuses the named control and reveals
 * that node's field-level errors, then clears the request.
 */
export type TWorkflowNodeFieldFocusRequest = {
  nodeId: string;
  /**
   * Config key within the node's form, e.g. "to" | "subject" | "body" | "surveyId" | "url", or
   * WORKFLOW_STEP_PANEL_FIELD to open the step's panel with nothing to focus.
   */
  field: string;
};

/** A focus request for the step's panel as a whole: it opens the panel and focuses no field. */
export const WORKFLOW_STEP_PANEL_FIELD = "step";

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

/**
 * The last save the server did not accept. Persistent by design: a failed autosave has no other
 * channel to report into (silent saves don't toast), so this is what the header pill reads to stay
 * red until a save succeeds. It doubles as the autosave no-retry guard — the effect refuses to
 * re-send `draftSignature`, so a broken draft can't loop one PATCH per debounce window.
 */
export type TWorkflowSaveError = {
  /** The exact draft that failed, as produced by workflowDraftSignatureAtom. */
  draftSignature: string;
  /**
   * "unreachable" = no response at all (offline, DNS, the 15s AbortSignal.timeout). Worth an
   * automatic retry once the browser reports it is back online.
   * "rejected" = the API answered with a problem document. Reconnecting changes nothing.
   */
  kind: "unreachable" | "rejected";
  /** Server-authored RFC 9457 detail, safe to show. Only populated for "rejected". */
  detail: string | null;
};

type TWorkflowEditorState = {
  workflow: TWorkflowResource | null;
  /**
   * Auth-derived: the current member has read-only workspace access. Seeded at hydrate time so the
   * canvas atoms (which the node card reads directly, bypassing the hook layer) can gate mutations
   * on permissions, not just status. See canEditWorkflowDefinitionAtom.
   */
  isReadOnly: boolean;
  workflowName: string;
  workflowDescription: string;
  definition: TWorkflowDefinition | null;
  lastSavedDraft: TWorkflowSavedDraft | null;
  /** Epoch ms of the last successful save this session; drives the "Changes saved" flash. */
  lastSavedAt: number | null;
  saveError: TWorkflowSaveError | null;
  selectedNodeId: string | null;
  fieldFocusRequest: TWorkflowNodeFieldFocusRequest | null;
  isInspectorCollapsed: boolean;
  isSnapToCanvasEnabled: boolean;
  isNodeConfigModalOpen: boolean;
  isSaving: boolean;
  isTransitioning: boolean;
};

const initialWorkflowEditorState: TWorkflowEditorState = {
  workflow: null,
  isReadOnly: false,
  workflowName: "",
  workflowDescription: "",
  definition: null,
  lastSavedDraft: null,
  lastSavedAt: null,
  saveError: null,
  selectedNodeId: null,
  fieldFocusRequest: null,
  isInspectorCollapsed: false,
  isSnapToCanvasEnabled: true,
  isNodeConfigModalOpen: false,
  isSaving: false,
  isTransitioning: false,
};

export const workflowEditorAtom = atom<TWorkflowEditorState>(initialWorkflowEditorState);

export const workflowAtom = atom((get) => get(workflowEditorAtom).workflow);
export const workflowNameAtom = atom((get) => get(workflowEditorAtom).workflowName);
export const workflowStatusAtom = atom((get) => get(workflowEditorAtom).workflow?.status ?? null);
export const workflowDescriptionAtom = atom((get) => get(workflowEditorAtom).workflowDescription);
export const workflowDefinitionAtom = atom((get) => get(workflowEditorAtom).definition);
export const selectedWorkflowNodeIdAtom = atom((get) => get(workflowEditorAtom).selectedNodeId);
export const workflowNodeFieldFocusRequestAtom = atom((get) => get(workflowEditorAtom).fieldFocusRequest);

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

// ENG-3395: the trigger's survey is restricted while survey visibility is enforced, so the server
// refuses to enable or test the workflow and the runner skips its responses. Owned by the builder
// page, which holds the server-side gate and the survey list; false (today's behaviour) until synced.
export const isTriggerSurveyRestrictedAtom = atom<boolean>(false);
// The restricted-surveys gate itself, for the trigger's survey picker. Set by the builder page.
export const isSurveyVisibilityEnabledAtom = atom<boolean>(false);

// Trigger ending-card ids the reconcile dropped this session (see useReconcileTriggerEndingCards).
// Client-only, not part of the definition: it records that the user's "specific endings" intent was
// emptied by now-deleted ids — which an empty `endingCardIds` ("all endings") can't express — so the
// trigger form keeps "specific" scope and asks for a fresh pick.
export const prunedTriggerEndingCardIdsAtom = atom<string[]>([]);

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
      // Cleared in the same write as lastSavedAt so the pill can never render the failed state and
      // the "Changes saved" flash across two commits. Covers every save path at once: autosave,
      // the unmount flush and the pre-transition flush all land here on success.
      draft.saveError = null;
    })
  );
});

export const workflowLastSavedAtAtom = atom((get) => get(workflowEditorAtom).lastSavedAt);

// The last secret settle below: what was sent, and the definition it left. Undo history (use-workflow-history)
// reads it so the settle isn't recorded as an edit, and so older steps drop the same plaintext values.
export const lastSecretSettleAtom = atom<{ sent: TWorkflowDefinition; result: TWorkflowDefinition } | null>(
  null
);

// After a save, the secret header values it sent are stored server-side: keep them out of the draft
// (and out of the saved snapshot, so this is no edit) or the next autosave would send them again.
// A secret the draft shows as set but the save stored no value for (see settleUnstoredSecrets) is unset.
export const settleSentSecretHeaderValuesAtom = atom(
  null,
  (get, set, { sent, saved }: { sent: TWorkflowDefinition; saved: TWorkflowDefinition | null }) => {
    const state = get(workflowEditorAtom);
    const settle = (definition: TWorkflowDefinition) => {
      const swapped = settleSentSecretValues(definition, sent);
      return saved ? settleUnstoredSecrets(swapped, saved) : swapped;
    };
    const definition = state.definition ? settle(state.definition) : null;
    const savedDefinition = state.lastSavedDraft?.definition ? settle(state.lastSavedDraft.definition) : null;
    if (definition === state.definition && savedDefinition === (state.lastSavedDraft?.definition ?? null)) {
      return;
    }
    set(
      workflowEditorAtom,
      produce(state, (draft) => {
        draft.definition = definition;
        if (draft.lastSavedDraft) draft.lastSavedDraft.definition = savedDefinition;
      })
    );
    if (definition)
      set(lastSecretSettleAtom, { sent, result: get(workflowEditorAtom).definition ?? definition });
  }
);

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

// Identity of the current editable draft. Derived (rather than recomputed per render by each
// consumer) so the value save() records as failed and the value the autosave effect compares
// against are the same string by construction. Raw, untrimmed: this identifies a draft, it does not
// decide dirtiness — isWorkflowDirtyAtom above owns that and trims.
export const workflowDraftSignatureAtom = atom((get) => {
  const state = get(workflowEditorAtom);
  return JSON.stringify({
    workflowName: state.workflowName,
    workflowDescription: state.workflowDescription,
    definition: state.definition,
  });
});

export const workflowSaveErrorAtom = atom((get) => get(workflowEditorAtom).saveError);

// Drives the header pill's failed state. Gated on dirtiness so reverting the draft back to what was
// last persisted clears the alarm: nothing is unsaved, so nothing should read "Save failed". Also
// scoped to the *exact* draft that failed (its signature): after the user edits past a rejected
// save — most notably clearing the name, which makes the draft unsendable — this flag drops so the
// pill can report the current state (e.g. the amber "Not saved") instead of a stale rejection whose
// reason no longer applies. This mirrors the autosave effect's own no-retry guard, which likewise
// keys off `saveError.draftSignature === draftSignature`.
export const hasWorkflowSaveFailedAtom = atom((get) => {
  const saveError = get(workflowEditorAtom).saveError;
  if (!saveError || !get(isWorkflowDirtyAtom)) return false;
  return saveError.draftSignature === get(workflowDraftSignatureAtom);
});

export type TWorkflowValidity = {
  /** The workflow has a non-empty name (required by the PATCH contract). */
  isNameValid: boolean;
  /** The definition passes the same executable-subset schema enable/test enforce server-side. */
  isDefinitionExecutable: boolean;
  /** The trigger's surveyId resolves to a real survey (see hasBoundTriggerSurveyAtom). */
  hasBoundTriggerSurvey: boolean;
  /**
   * The editor is hydrated and the derived problem list is empty. Matches the server's enable
   * pre-flight except its ending-cards check, which needs server data (see the component-level
   * merge in WorkflowValidationStatus) — the server still rejects enable on stale endings.
   */
  isReady: boolean;
};

export type TWorkflowValidationProblemCode =
  | "name_missing"
  | "trigger_missing"
  | "trigger_survey_unbound"
  | "trigger_survey_restricted"
  | "trigger_ending_not_found"
  | "trigger_not_connected"
  | "flow_invalid"
  | "step_not_executable"
  | "step_incomplete"
  | "step_needs_setup"
  | "survey_link_not_placed"
  | "survey_link_without_survey"
  | "definition_invalid";

export type TWorkflowValidationProblem = {
  /** Machine-readable category the problems dialog localizes per code. */
  code: TWorkflowValidationProblemCode;
  /** Dotted path into the definition (or "name"), mirroring the server's test-problem fields. */
  field: string;
};

/**
 * The `field` paths a validation problem can carry, as builders + matchers rather than bare
 * strings. The problems dialog resolves these back to a control to focus (see
 * `getWorkflowValidationProblemFocusTarget`), so producer and consumer must agree — with literals
 * on both sides, renaming one silently stops the dialog's "Fix" jump from resolving, with nothing
 * failing to catch it. Anything that reads or writes a problem `field` goes through here.
 */
export const workflowProblemFields = {
  name: "name",
  trigger: "trigger",
  triggerSurveyId: "trigger.config.surveyId",
  triggerEndingCardIds: "trigger.config.endingCardIds",
  /** The step-level path `step_incomplete` groups a send_email node's blank fields under. */
  nodeConfig: (nodeIndex: number) => `nodes.${nodeIndex}.config`,
  /** Index back out of a `nodeConfig` path; null for any other shape (`nodes.N.type`, `edges`, …). */
  parseNodeConfigIndex: (field: string): number | null => {
    const match = /^nodes\.(\d+)\.config$/.exec(field);
    return match ? Number(match[1]) : null;
  },
} as const;

/**
 * An email step's problem by the config path it is at: a blank recipient, subject or body; a survey
 * link the body doesn't place, or a Survey link chip with no link; else a general one (a fixed-text
 * rule, an Embedded Data value), never "fill in" fields that are filled in.
 */
const getEmailStepProblemCode = (
  configPath: string[],
  config: Extract<TWorkflowDefinition["nodes"][number], { actionType: "send_email" }>["config"]
): TWorkflowValidationProblemCode => {
  const [configField] = configPath;
  if ((getBlankSendEmailContentFields(config) as string[]).includes(configField)) return "step_incomplete";
  if (configField === "body" && hasUnplacedSurveyLink(config)) return "survey_link_not_placed";
  if (configField === "surveyLink" && configPath.length === 1 && !config.surveyLink) {
    return "survey_link_without_survey";
  }
  return "step_needs_setup";
};

// The `nodes…` part of categorizeDefinitionIssue; null for a path it doesn't bucket.
const categorizeNodeIssue = (
  path: string[],
  field: string,
  definition: TWorkflowDefinition
): TWorkflowValidationProblem | null => {
  const third = path[2];
  if (path.length === 1) {
    // Unreachable or duplicated nodes — the graph shape is broken.
    return { code: "flow_invalid", field };
  }
  if (third === "type") {
    return { code: "step_not_executable", field };
  }
  if (third === "config") {
    // Grouped per step, not per field, so the badge count matches what the user perceives as one
    // unfinished step. An email step says which of its problems it has; any other step (an HTTP
    // request without a URL, an If/else on a Variable it can't see) gets a general message.
    const nodeIndex = Number(path[1]);
    const node = definition.nodes[nodeIndex];
    const isEmail = node?.type === "action" && node.actionType === "send_email";
    return {
      code: isEmail ? getEmailStepProblemCode(path.slice(3), node.config) : "step_needs_setup",
      field: workflowProblemFields.nodeConfig(nodeIndex),
    };
  }
  return null;
};

// Buckets one ZWorkflowEnableDefinition issue by its path. Total: every issue maps to some
// code (worst case the generic fallback), so a failed parse always yields at least one problem
// and the problem list can never read "valid" while workflowValidityAtom says not executable.
const categorizeDefinitionIssue = (
  issuePath: ReadonlyArray<PropertyKey>,
  context: { hasTrigger: boolean; isTriggerConnected: boolean; definition: TWorkflowDefinition }
): TWorkflowValidationProblem => {
  const path = issuePath.map(String);
  const field = path.join(".") || "definition";
  const [root] = path;

  if (root === "trigger" || root === "entryNodeId") {
    // Without a trigger both fields fail together; normalizing the field collapses them into a
    // single "add a trigger" problem. With a trigger present this is an unexpected shape issue.
    return context.hasTrigger
      ? { code: "definition_invalid", field }
      : { code: "trigger_missing", field: workflowProblemFields.trigger };
  }

  if (root === "edges") {
    // Several rules report at the bare `edges` path: the exactly-one-trigger-edge check, the
    // if_else then/else branch counts, and the acyclic check. While the trigger has no outgoing
    // edge they are all attributed to the unconnected trigger — a known conflation, but a bounded
    // one: the editor cannot author branch/cycle failures in that state, and the API-authored
    // definitions that can also carry companion problems (step_not_executable, unreachable
    // nodes) that keep the count honest until the trigger is connected and these resurface as
    // flow_invalid.
    if (path.length === 1 && !context.isTriggerConnected) {
      return { code: "trigger_not_connected", field };
    }
    return { code: "flow_invalid", field };
  }

  if (root === "nodes") {
    const nodeProblem = categorizeNodeIssue(path, field, context.definition);
    if (nodeProblem) return nodeProblem;
  }

  return { code: "definition_invalid", field };
};

export type TWorkflowValidation = {
  problems: TWorkflowValidationProblem[];
  validity: TWorkflowValidity;
};

/**
 * The trigger survey's own problem, if any. Unbound wins: a survey that cannot be resolved has no
 * visibility worth reporting. Restricted mirrors the server's `survey_not_workspace_visible`.
 */
const getTriggerSurveyProblem = ({
  hasTrigger,
  hasBoundTriggerSurvey,
  isTriggerSurveyRestricted,
}: {
  hasTrigger: boolean;
  hasBoundTriggerSurvey: boolean;
  isTriggerSurveyRestricted: boolean;
}): TWorkflowValidationProblem | null => {
  if (!hasTrigger) return null;
  if (!hasBoundTriggerSurvey) {
    return { code: "trigger_survey_unbound", field: workflowProblemFields.triggerSurveyId };
  }
  if (isTriggerSurveyRestricted) {
    return { code: "trigger_survey_restricted", field: workflowProblemFields.triggerSurveyId };
  }
  return null;
};

/**
 * The single implementation of the editor's live readiness rules (name, survey binding,
 * executable-subset schema): one safeParse produces both the typed problem list the canvas
 * status indicator counts and the boolean validity the header's Enable gate reads. `isReady`
 * is defined AS "hydrated with an empty problem list", so the two views can never disagree.
 */
export const deriveWorkflowValidation = ({
  workflowName,
  definition,
  hasBoundTriggerSurvey,
  isTriggerSurveyRestricted = false,
}: {
  workflowName: string;
  definition: TWorkflowDefinition | null;
  hasBoundTriggerSurvey: boolean;
  /** ENG-3395: the bound survey is restricted, which the server's enable/test pre-flight refuses. */
  isTriggerSurveyRestricted?: boolean;
}): TWorkflowValidation => {
  const problems: TWorkflowValidationProblem[] = [];

  const isNameValid = workflowName.trim().length > 0;
  if (!isNameValid) {
    problems.push({ code: "name_missing", field: workflowProblemFields.name });
  }

  // No definition means the editor isn't hydrated yet; there is nothing to validate (the status
  // indicator doesn't render before hydration either) and the workflow cannot be ready.
  let isDefinitionExecutable = false;
  if (definition) {
    const hasTrigger = definition.trigger !== null;
    // The survey binding is only meaningful once a trigger exists — for trigger-less drafts the
    // builder page reports it unbound, but `trigger_missing` already says everything.
    // Only a Response completed trigger is bound to a survey; a Webhook trigger has none to pick.
    const triggerSurveyProblem = getTriggerSurveyProblem({
      hasTrigger: isResponseCompletedTrigger(definition.trigger),
      hasBoundTriggerSurvey,
      isTriggerSurveyRestricted,
    });
    if (triggerSurveyProblem) problems.push(triggerSurveyProblem);

    // Secret headers are checked in the shape the server will store them in (see the helper).
    const parsed = ZWorkflowEnableDefinition.safeParse(withSecretIdsForCheck(definition));
    isDefinitionExecutable = parsed.success;
    if (!parsed.success) {
      const isTriggerConnected = definition.edges.some((edge) => edge.source === definition.trigger?.id);
      for (const issue of parsed.error.issues) {
        problems.push(categorizeDefinitionIssue(issue.path, { hasTrigger, isTriggerConnected, definition }));
      }
    }
  }

  // Categorization intentionally funnels related issues into one bucket (e.g. a missing trigger,
  // a step's empty fields); dropping the duplicates keeps the badge count honest.
  const seen = new Set<string>();
  const dedupedProblems = problems.filter((problem) => {
    const key = `${problem.code}:${problem.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    problems: dedupedProblems,
    validity: {
      isNameValid,
      isDefinitionExecutable,
      hasBoundTriggerSurvey,
      isReady: definition !== null && dedupedProblems.length === 0,
    },
  };
};

/**
 * The one readiness rule that needs server data: whether the trigger's configured ending cards
 * still exist on the bound survey. Server data lives in the TanStack Query cache (never mirrored
 * into Jotai), so WorkflowValidationStatus merges this at the component level instead of inside
 * workflowValidationProblemsAtom — meaning workflowValidityAtom.isReady (the header's Enable
 * gate) deliberately does not include it; the server's enable pre-flight still rejects stale
 * endings. Grouped like step_incomplete: however many endings went stale, it is one problem.
 */
export const deriveTriggerEndingProblems = (
  endingCardIds: readonly string[],
  availableEndingIds: readonly string[]
): TWorkflowValidationProblem[] => {
  const available = new Set(availableEndingIds);
  const hasMissingEnding = endingCardIds.some((endingCardId) => !available.has(endingCardId));
  return hasMissingEnding
    ? [{ code: "trigger_ending_not_found", field: workflowProblemFields.triggerEndingCardIds }]
    : [];
};

// Live validation, recomputed on every draft edit. Mirrors the server's enable/test checks
// (ZWorkflowEnableDefinition plus the survey binding) so the editor can flag an unready
// workflow immediately instead of after a round-trip. Private: consumers read the slices below.
const workflowValidationAtom = atom<TWorkflowValidation>((get) => {
  const state = get(workflowEditorAtom);
  return deriveWorkflowValidation({
    workflowName: state.workflowName,
    definition: state.definition,
    hasBoundTriggerSurvey: get(hasBoundTriggerSurveyAtom),
    isTriggerSurveyRestricted: get(isTriggerSurveyRestrictedAtom),
  });
});

export const workflowValidityAtom = atom((get) => get(workflowValidationAtom).validity);

// The problem list behind the canvas's validation status indicator and its dialog.
export const workflowValidationProblemsAtom = atom((get) => get(workflowValidationAtom).problems);

// Locked = pan mode (pan/browse; nodes are inert), unlocked = pointer mode (select/inspect,
// edit when status/permissions allow). Pointer is the default tool and the toggle is purely
// user-driven — nothing auto-switches it; mutations are gated separately by canMutateCanvasAtom.
export const isCanvasLockedAtom = atom<boolean>(false);

// Which way the canvas reads, as the workflow saved it (`definition.ui.direction`); top to bottom when
// it has none. Switched from the Layout menu.
export const workflowCanvasDirectionAtom = atom<TWorkflowCanvasDirection>((get) => {
  const definition = get(workflowEditorAtom).definition;
  return definition ? getCanvasDirection(definition) : "vertical";
});

// Auth-derived read-only flag, seeded at hydrate time. Exposed so the inspector can name the
// actual reason edits are blocked (permission vs. status).
export const isWorkflowReadOnlyAtom = atom((get) => get(workflowEditorAtom).isReadOnly);

// Derived: the workflow's definition is editable when both status and permissions allow it. The API
// rejects definition PATCHes on enabled / archived workflows, and a read-only member may not edit at
// all. This atom is the single source the canvas node card reads directly — folding `isReadOnly` in
// here (rather than only in the hook layer) keeps that card from offering add/delete/drag to a
// read-only member on a draft workflow, where the status check alone would pass.
export const canEditWorkflowDefinitionAtom = atom((get) => {
  const state = get(workflowEditorAtom);
  if (state.isReadOnly) return false;
  const status = state.workflow?.status;
  return status === "draft" || status === "disabled";
});

// Combined gate for any interactive canvas affordance (add + delete + drag + auto-layout).
// Both the API-side status check AND the user-driven lock must allow it.
export const canMutateCanvasAtom = atom(
  (get) => get(canEditWorkflowDefinitionAtom) && !get(isCanvasLockedAtom)
);

export const setWorkflowSaveErrorAtom = atom(null, (get, set, saveError: TWorkflowSaveError | null) => {
  // Bail when nothing changes so a redundant clear (e.g. an `online` event with no failure pending)
  // doesn't produce a new state object and re-render every editor subscriber.
  if (get(workflowEditorAtom).saveError === saveError) return;
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.saveError = saveError;
    })
  );
});

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
      isReadOnly,
    }: {
      workflow: TWorkflowResource;
      flowNodes: Array<Node<TWorkflowNodeData>>;
      isReadOnly: boolean;
    }
  ) => {
    // Optimistic default until the builder page re-syncs it from the authoring context;
    // without the reset, a previous workflow's "unbound" state would flash on the next one.
    set(hasBoundTriggerSurveyAtom, true);
    set(isTriggerSurveyRestrictedAtom, false);
    // Same reasoning: a previous workflow's pruned ids must not leak into this one's trigger form.
    set(prunedTriggerEndingCardIdsAtom, []);
    // Set outside the produce below so the nodes stay unfrozen (see workflowFlowNodesAtom).
    set(workflowFlowNodesAtom, flowNodes);
    set(
      workflowEditorAtom,
      produce(initialWorkflowEditorState, (draft) => {
        draft.workflow = workflow;
        draft.isReadOnly = isReadOnly;
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
      // A plain node click is not a jump: drop any request a form never got to consume (e.g. one
      // aimed at a node whose type has no config form) so it can't fire later out of context.
      draft.fieldFocusRequest = null;
    })
  );
});

// Jump to a specific field: same panel-opening effect as clicking the node, plus the pending
// focus request its config form consumes. Raised by the validation problems dialog.
export const requestWorkflowNodeFieldFocusAtom = atom(
  null,
  (get, set, request: TWorkflowNodeFieldFocusRequest) => {
    set(
      workflowEditorAtom,
      produce(get(workflowEditorAtom), (draft) => {
        draft.selectedNodeId = request.nodeId;
        draft.isNodeConfigModalOpen = true;
        draft.isInspectorCollapsed = false;
        // A whole-panel request has no field for a form to consume, so it leaves nothing pending.
        draft.fieldFocusRequest = request.field === WORKFLOW_STEP_PANEL_FIELD ? null : request;
      })
    );
  }
);

// Cleared by the form once it has focused the control, so remounting the panel later (e.g. after
// switching nodes and back) doesn't re-fire a stale jump.
export const clearWorkflowNodeFieldFocusAtom = atom(null, (get, set) => {
  if (!get(workflowEditorAtom).fieldFocusRequest) return;
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.fieldFocusRequest = null;
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
// graph stays connected (preserving the incoming sourceHandle for if_else branches). An If/else or a
// Switch goes with its branches instead (spec §2): the canvas confirms that first. Refuses to delete
// the trigger.
export const deleteWorkflowNodeAtom = atom(null, (get, set, nodeId: string) => {
  const current = get(workflowEditorAtom).definition;
  const isBranching = isBranchingStep(current?.nodes.find((node) => node.id === nodeId));
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      const definition = draft.definition;
      if (!definition || !current) return;
      if (definition.trigger?.id === nodeId) return;

      if (isBranching) {
        const remaining = removeBranchingStepWithBranches(current, nodeId);
        const remainingIds = new Set(remaining.nodes.map((node) => node.id));
        definition.nodes = definition.nodes.filter((node) => remainingIds.has(node.id));
        definition.edges = definition.edges.filter((edge) =>
          remaining.edges.some((kept) => kept.id === edge.id)
        );
        if (draft.selectedNodeId && !remainingIds.has(draft.selectedNodeId)) {
          draft.selectedNodeId = definition.trigger?.id ?? null;
          draft.isNodeConfigModalOpen = false;
        }
        return;
      }

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

/** An If/else or Switch whose deletion was asked for from the keyboard; its card asks to confirm. */
export const stepDeleteRequestAtom = atom<string | null>(null);

// Seed the trigger on an empty draft canvas (the "Add trigger" picker). A Response completed trigger
// gets a placeholder surveyId that keeps the config schema-valid until the user binds a real survey;
// a Webhook trigger has nothing to configure (its Secret URL is issued when the save lands). Opening
// the config panel right away walks them into the next step either way.
export const addWorkflowTriggerAtom = atom(null, (get, set, triggerType: TWorkflowTriggerType) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      const definition = draft.definition;
      if (!definition || definition.trigger) return;

      const trigger = createDefaultTrigger(triggerType);
      const triggerId = trigger.id;
      definition.trigger = trigger;
      definition.entryNodeId = triggerId;

      draft.selectedNodeId = triggerId;
      draft.isNodeConfigModalOpen = true;
    })
  );
});

// Fallback canvas position when the reference node/edge carries no stored position.
const SEND_EMAIL_FALLBACK_POSITION = { x: 220, y: 200 };

/** Whether one more step fits (spec §10: 25 per workflow); the add-step menu disables at the limit. */
export const canAddWorkflowStepAtom = atom((get) => {
  const definition = get(workflowEditorAtom).definition;
  return definition !== null && definition.nodes.length < WORKFLOW_LIMITS.maxSteps;
});

export type TAppendWorkflowStepInput = {
  sourceNodeId: string;
  stepType: TAddableWorkflowStepType;
  /** With a branch, the source is an If/else or a Switch and the step starts that branch. */
  branch?: string;
  /** A new If/else's first condition, or a new Switch, compares this Variable. */
  conditionPath?: string;
  /** A new Switch case's name, translated by the caller. */
  caseName?: (number: number) => string;
};

/**
 * Steps saved without a position (through API v3 or MCP) are laid out when the canvas draws them. A
 * step added among them first pins every step where the canvas shows it, so the new one lands next to
 * the steps the user sees and they stay where they were.
 */
const pinDisplayedPositions = (
  definition: TWorkflowDefinition,
  flowNodes: ReadonlyArray<Node<TWorkflowNodeData>>
): void => {
  const shown = new Map(flowNodes.map((node) => [node.id, node.position]));
  for (const node of [definition.trigger, ...definition.nodes]) {
    if (!node || node.ui?.position) continue;
    const position = shown.get(node.id);
    if (position)
      node.ui = { ...node.ui, position: { x: Math.round(position.x), y: Math.round(position.y) } };
  }
};

// Append a fresh step after `sourceNodeId` (the end of the chain or of a branch) and open it. Refused
// at the step limit, which saving would refuse too.
export const appendWorkflowStepAfterNodeAtom = atom(null, (get, set, input: TAppendWorkflowStepInput) => {
  if (!get(canAddWorkflowStepAtom)) return;
  const { sourceNodeId, stepType, branch, conditionPath, caseName } = input;
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      const definition = draft.definition;
      if (!definition) return;
      pinDisplayedPositions(definition, get(workflowFlowNodesAtom));

      const sourceNode = definition.nodes.find((node) => node.id === sourceNodeId);
      const sourcePosition =
        definition.trigger?.id === sourceNodeId ? definition.trigger.ui?.position : sourceNode?.ui?.position;
      const direction = get(workflowCanvasDirectionAtom);
      const legOffset =
        branch !== undefined && sourceNode
          ? getBranchLegOffset(definition, sourceNode, branch, direction)
          : null;
      const newPosition = sourcePosition
        ? getAppendedStepPosition(sourcePosition, legOffset, direction)
        : SEND_EMAIL_FALLBACK_POSITION;

      const newNode = createDefaultWorkflowStep(stepType, newPosition, { conditionPath, caseName });
      definition.nodes.push(newNode);

      definition.edges.push({
        id: createId(),
        source: sourceNodeId,
        target: newNode.id,
        ...(branch ? { sourceHandle: branch } : {}),
      });

      draft.selectedNodeId = newNode.id;
      draft.isNodeConfigModalOpen = true;
    })
  );
});

// Append a fresh send_email node after `sourceNodeId`; kept for callers that only add emails.
export const appendSendEmailAfterNodeAtom = atom(null, (_get, set, sourceNodeId: string, branch?: string) => {
  set(appendWorkflowStepAfterNodeAtom, { sourceNodeId, stepType: "send_email", branch });
});

export type TInsertWorkflowStepInput = Omit<TAppendWorkflowStepInput, "sourceNodeId" | "branch"> & {
  /** The line the step goes on: the step between its two ends. */
  edgeId: string;
};

/**
 * Inserts a fresh step on a line, between the two steps it connects, and opens it. The new step takes
 * the place of the line's target, and the target with every step after it moves one step further
 * along, so a layout arranged by hand stays as it was. A new If/else or Switch carries on to the
 * target through its first branch. The line keeps its branch when it leaves an If/else or a Switch.
 * Refused at the step limit, which saving would refuse too.
 */
export const insertWorkflowStepOnEdgeAtom = atom(null, (get, set, input: TInsertWorkflowStepInput) => {
  if (!get(canAddWorkflowStepAtom)) return;
  const { edgeId, stepType, conditionPath, caseName } = input;
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      const definition = draft.definition;
      if (!definition) return;
      const edgeIndex = definition.edges.findIndex((edge) => edge.id === edgeId);
      if (edgeIndex < 0) return;
      pinDisplayedPositions(definition, get(workflowFlowNodesAtom));
      const edge = definition.edges[edgeIndex];
      const target = definition.nodes.find((node) => node.id === edge.target);
      const targetPosition = target?.ui?.position ?? SEND_EMAIL_FALLBACK_POSITION;

      const newNode = createDefaultWorkflowStep(stepType, targetPosition, { conditionPath, caseName });
      const firstBranch = getBranchHandles(newNode)?.[0];

      // Everything from the target on moves by one step: one row (or column), or a branch row when the
      // new step forks.
      const direction = get(workflowCanvasDirectionAtom);
      const moved = getAppendedStepPosition(targetPosition, firstBranch ? 0 : null, direction);
      const shift = { x: moved.x - targetPosition.x, y: moved.y - targetPosition.y };
      const downstream = new Set([edge.target]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const next of definition.edges) {
          if (downstream.has(next.source) && !downstream.has(next.target)) {
            downstream.add(next.target);
            grew = true;
          }
        }
      }
      for (const node of definition.nodes) {
        if (!downstream.has(node.id) || !node.ui?.position) continue;
        node.ui.position = { x: node.ui.position.x + shift.x, y: node.ui.position.y + shift.y };
      }

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
        {
          id: createId(),
          source: newNode.id,
          target: edge.target,
          ...(firstBranch ? { sourceHandle: firstBranch } : {}),
        }
      );

      draft.selectedNodeId = newNode.id;
      draft.isNodeConfigModalOpen = true;
    })
  );
});

// ---- Cut, copy and paste of steps (lib/step-clipboard.ts) ----

const stepClipboardStateAtom = atom<TStepClipboard | null>(null);

/** What is cut or copied, for this workflow only; another workflow's clipboard reads as empty. */
export const workflowStepClipboardAtom = atom((get) => {
  const clipboard = get(stepClipboardStateAtom);
  return clipboard && clipboard.workflowId === get(workflowAtom)?.id ? clipboard : null;
});

/** The steps of a pending cut, drawn faded until they are pasted or put back. */
export const cutWorkflowStepIdsAtom = atom((get) => {
  const clipboard = get(workflowStepClipboardAtom);
  return new Set(clipboard?.mode === "cut" ? clipboard.stepIds : []);
});

/**
 * Cut a step and everything after it; a previous cut that wasn't pasted is put back. Returns how many
 * steps are on the clipboard, 0 when nothing was cut.
 */
export const cutWorkflowStepAtom = atom(null, (get, set, nodeId: string): number => {
  const definition = get(workflowEditorAtom).definition;
  const workflowId = get(workflowAtom)?.id;
  if (!definition || !workflowId || definition.trigger?.id === nodeId) return 0;
  const stepIds = getStepAndAfter(definition, nodeId);
  set(stepClipboardStateAtom, { mode: "cut", workflowId, rootId: nodeId, stepIds });
  return stepIds.length;
});

/**
 * Copy a step and everything after it; a pending cut is put back. Returns how many steps are on the
 * clipboard, 0 when nothing was copied.
 */
export const copyWorkflowStepAtom = atom(null, (get, set, nodeId: string): number => {
  const definition = get(workflowEditorAtom).definition;
  const workflowId = get(workflowAtom)?.id;
  if (!definition || !workflowId || definition.trigger?.id === nodeId) return 0;
  const captured = captureStepCopy(definition, nodeId);
  set(stepClipboardStateAtom, { mode: "copy", workflowId, rootId: nodeId, ...captured });
  return captured.nodes.length;
});

/** Puts a pending cut back: Escape, Undo. A copy stays on the clipboard. */
export const cancelWorkflowStepCutAtom = atom(null, (get, set) => {
  if (get(stepClipboardStateAtom)?.mode === "cut") set(stepClipboardStateAtom, null);
});

/** Whether a `+` offers "Paste here". */
export const canPasteWorkflowStepsAtAtom = atom((get) => {
  const clipboard = get(workflowStepClipboardAtom);
  const definition = get(workflowEditorAtom).definition;
  const canEdit = get(canEditWorkflowDefinitionAtom);
  return (target: TPasteTarget) =>
    canEdit && definition !== null && canPasteAt(definition, clipboard, target);
});

export type TPasteWorkflowStepsResult =
  | { ok: true; stepCount: number; mode: TStepClipboard["mode"] }
  | { ok: false; reason: "nothing" | "step_limit" };

/**
 * Pastes the clipboard at a `+` and opens its first step. A cut moves its steps and empties the
 * clipboard; a copy adds fresh steps and stays, for another paste. Refused over the step limit.
 */
export const pasteWorkflowStepsAtom = atom(
  null,
  (
    get,
    set,
    input: { target: TPasteTarget; copyLabel: (node: TWorkflowDefinition["nodes"][number]) => string }
  ): TPasteWorkflowStepsResult => {
    const clipboard = get(workflowStepClipboardAtom);
    const editor = get(workflowEditorAtom);
    if (!clipboard || !editor.definition || !get(canEditWorkflowDefinitionAtom)) {
      return { ok: false, reason: "nothing" };
    }
    if (
      clipboard.mode === "copy" &&
      editor.definition.nodes.length + clipboard.nodes.length > WORKFLOW_LIMITS.maxSteps
    ) {
      return { ok: false, reason: "step_limit" };
    }
    const pinned = produce(editor.definition, (draft) => {
      pinDisplayedPositions(draft, get(workflowFlowNodesAtom));
    });
    const result = pasteSteps({
      definition: pinned,
      clipboard,
      target: input.target,
      direction: get(workflowCanvasDirectionAtom),
      copyLabel: input.copyLabel,
    });
    if (!result) return { ok: false, reason: "nothing" };
    set(
      workflowEditorAtom,
      produce(editor, (draft) => {
        draft.definition = result.definition;
        draft.selectedNodeId = result.rootId;
        draft.isNodeConfigModalOpen = true;
      })
    );
    if (clipboard.mode === "cut") set(stepClipboardStateAtom, null);
    return { ok: true, stepCount: result.stepCount, mode: clipboard.mode };
  }
);

// ---- Moving a step onto a `+` (lib/step-move.ts) ----

/** A step card being dragged to another `+`; null while nothing is. */
export type TStepMoveDrag = {
  stepId: string;
  /** The card's position when the drag started; the fork legs stay drawn from it while dragging. */
  start: { x: number; y: number };
  /** The step and the steps it takes along, drawn faded while they move. */
  movingStepIds: ReadonlySet<string>;
  /** The `+` it can land on (getMoveTargetKey), lit while dragging. */
  targetKeys: ReadonlySet<string>;
  /** The `+` nearest the pointer, which reads "Move here"; a drop anywhere else just places the card. */
  hotTargetKey: string | null;
  /** Where the card was, drawn as a dashed outline. */
  origin: { x: number; y: number; width: number; height: number };
};

export const stepMoveDragAtom = atom<TStepMoveDrag | null>(null);

const NO_STEPS: ReadonlySet<string> = new Set();

/** The steps a dragged If/else, Switch or Filter takes along (not itself), faded like a pending cut. */
export const stepIdsMovingAlongAtom = atom((get) => get(stepMoveDragAtom)?.movingStepIds ?? NO_STEPS);

/**
 * Moves a step to a `+` as one edit (one Undo) and opens it; the other steps stay where they are. Returns the
 * definitions before and after, for the toast's Undo, and the Variables the move put before the step
 * they come from. Null when the step can't go there. A pending cut is put back first.
 */
export const moveWorkflowStepAtom = atom(
  null,
  (
    get,
    set,
    input: { stepId: string; target: TPasteTarget }
  ): (TMoveStepResult & { previous: TWorkflowDefinition }) | null => {
    const editor = get(workflowEditorAtom);
    if (!editor.definition || !get(canEditWorkflowDefinitionAtom)) return null;
    const result = moveStep({
      definition: editor.definition,
      stepId: input.stepId,
      target: input.target,
      direction: get(workflowCanvasDirectionAtom),
    });
    if (!result) return null;
    set(cancelWorkflowStepCutAtom);
    set(
      workflowEditorAtom,
      produce(editor, (draft) => {
        draft.definition = result.definition;
        draft.selectedNodeId = input.stepId;
        draft.isNodeConfigModalOpen = true;
      })
    );
    return { ...result, previous: editor.definition };
  }
);

/** The workflow history's Undo, registered by the history (it lives in the toolbar) for toasts to call. */
export const workflowUndoAtom = atom<{
  undo: () => void;
  /** Whether the next Undo puts back `earlier` (edits right after it, such as a panel opening, count with it). */
  undoesTo: (earlier: TWorkflowDefinition) => boolean;
} | null>(null);

export const setWorkflowSnapToCanvasEnabledAtom = atom(null, (get, set, isSnapToCanvasEnabled: boolean) => {
  set(
    workflowEditorAtom,
    produce(get(workflowEditorAtom), (draft) => {
      draft.isSnapToCanvasEnabled = isSnapToCanvasEnabled;
    })
  );
});
