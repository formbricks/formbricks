"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { type TCreateWorkflowTestRunInput, WORKFLOW_TRIGGERS } from "@formbricks/workflows";
import { useWorkflowBuilder } from "@/modules/ee/workflows/hooks/use-workflow-builder";
import { MUTATION_TIMEOUT_MS, createWorkflowTestRun } from "@/modules/ee/workflows/lib/api-client";
import { workflowRunKeys } from "@/modules/ee/workflows/lib/query";
import { getWorkflowRunsPath } from "@/modules/ee/workflows/lib/runs-view";
import {
  buildTestRunInput,
  classifyTestRunError,
  getTestRunBlocker,
} from "@/modules/ee/workflows/lib/test-run";
import { readStoredTestPayload } from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import {
  isWorkflowDirtyAtom,
  isWorkflowNodeConfigModalOpenAtom,
  isWorkflowSavingAtom,
  isWorkflowTransitioningAtom,
  selectedWorkflowNodeIdAtom,
  workflowAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";
import {
  EMPTY_TEST_RUN_STATE,
  closeTestFormAtom,
  editorTestRunAtom,
  isTestFormShownAtom,
  openTestFormAtom,
} from "@/modules/ee/workflows/state/test-run";

export type { TWorkflowTestRunFailure } from "@/modules/ee/workflows/state/test-run";

/**
 * Test run (ED6, ADR 0049; review point 1): saves the draft if needed, runs it, and shows the result in
 * the workflow's Runs view. The header's Test only shows or hides that view's test form
 * (`toggleTestForm`), keeping the step that was open; "Run test" there starts the run. A Webhook workflow sends the test input kept in this browser (else the server uses the
 * expected payload). A Response completed workflow runs against a response picked in the Runs view:
 * started without one, it waits for the pick there. The run goes into the query cache; the shared
 * `editorTestRunAtom` only says what is in flight, what failed and which run came back.
 */
export const useWorkflowTestRun = ({
  workspaceId,
  workflowId,
  isReadOnly,
}: {
  workspaceId: string;
  workflowId: string;
  isReadOnly: boolean;
}) => {
  const store = useStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const state = useAtomValue(editorTestRunAtom);
  const setState = useSetAtom(editorTestRunAtom);
  const { save } = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });
  const runsPath = getWorkflowRunsPath(workspaceId, workflowId);

  // Callbacks on the mutation itself (not on `mutate`), so a run started in one tab still lands
  // after the user switches to the other.
  const { mutate } = useMutation({
    mutationFn: (input: TCreateWorkflowTestRunInput) => createWorkflowTestRun(workflowId, input),
    onSuccess: (run) => {
      queryClient.setQueryData(workflowRunKeys.detail(run.id), run);
      void queryClient.invalidateQueries({ queryKey: workflowRunKeys.lists() });
      setState({ ...EMPTY_TEST_RUN_STATE, runId: run.id });
    },
    onError: (error, input) => {
      setState({
        ...EMPTY_TEST_RUN_STATE,
        failure: classifyTestRunError(error, {
          sentPayload: input.payload !== undefined,
          sentResponseId: input.responseId !== undefined,
        }),
        error,
      });
    },
  });

  // A save already in flight carries an older snapshot; let it land before deciding whether the
  // draft still needs one, so the Test run runs what is on screen.
  const waitForSaveToSettle = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const isBusy = () => store.get(isWorkflowSavingAtom) || store.get(isWorkflowTransitioningAtom);
        if (!isBusy()) return resolve();
        const unsubscribe = store.sub(isWorkflowSavingAtom, () => {
          if (isBusy()) return;
          unsubscribe();
          resolve();
        });
        setTimeout(() => {
          unsubscribe();
          resolve();
        }, MUTATION_TIMEOUT_MS);
      }),
    [store]
  );

  // From the Editor, the result is read in Runs, on the step that was open.
  const openRunsView = useCallback(() => {
    if (pathname === runsPath) return;
    const openStepId = store.get(isWorkflowNodeConfigModalOpenAtom)
      ? store.get(selectedWorkflowNodeIdAtom)
      : null;
    router.push(openStepId ? `${runsPath}?step=${encodeURIComponent(openStepId)}` : runsPath);
  }, [pathname, runsPath, router, store]);

  /** Without a response, a Response completed workflow waits for one to be picked in Runs. */
  const startTestRun = useCallback(
    async (responseId?: string) => {
      const workflow = store.get(workflowAtom);
      if (!workflow || isReadOnly || store.get(editorTestRunAtom).isRunning) return;

      setState({ ...EMPTY_TEST_RUN_STATE, isRunning: true });
      openRunsView();

      const definition = store.get(workflowDefinitionAtom);
      const blocker = getTestRunBlocker({
        triggerType: definition?.trigger?.triggerType ?? null,
        status: workflow.status,
      });
      if (blocker) {
        setState({ ...EMPTY_TEST_RUN_STATE, failure: blocker });
        return;
      }

      await waitForSaveToSettle();
      if (store.get(isWorkflowDirtyAtom) && !(await save({ silent: true }))) {
        setState({ ...EMPTY_TEST_RUN_STATE, failure: "unsaved" });
        return;
      }

      if (definition?.trigger?.triggerType === WORKFLOW_TRIGGERS.RESPONSE_COMPLETED) {
        if (responseId) mutate({ responseId });
        else setState({ ...EMPTY_TEST_RUN_STATE, isPickingResponse: true });
        return;
      }

      const built = buildTestRunInput(readStoredTestPayload(workflowId));
      if (!built.ok) {
        setState({ ...EMPTY_TEST_RUN_STATE, failure: built.reason });
        return;
      }
      mutate(built.input);
    },
    [store, isReadOnly, setState, openRunsView, waitForSaveToSettle, save, workflowId, mutate]
  );

  /**
   * The header's Test, the only one: in Runs it shows or hides the test form; from the Editor it opens
   * Runs with the form shown and "Run test" focused. It runs nothing itself.
   */
  const isOnRunsView = pathname === runsPath;
  const isTestFormShown = useAtomValue(isTestFormShownAtom);
  const toggleTestForm = useCallback(() => {
    if (isOnRunsView && store.get(isTestFormShownAtom)) {
      store.set(closeTestFormAtom);
      return;
    }
    store.set(openTestFormAtom);
    openRunsView();
  }, [isOnRunsView, store, openRunsView]);

  return { ...state, startTestRun, toggleTestForm, isTestFormActive: isOnRunsView && isTestFormShown };
};
