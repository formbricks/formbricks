"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtom, useStore } from "jotai";
import { useCallback, useState } from "react";
import type { TCreateWorkflowTestRunInput } from "@formbricks/workflows";
import { useWorkflowBuilder } from "@/modules/ee/workflows/hooks/use-workflow-builder";
import { MUTATION_TIMEOUT_MS, createWorkflowTestRun } from "@/modules/ee/workflows/lib/api-client";
import { workflowRunKeys } from "@/modules/ee/workflows/lib/query";
import {
  type TTestRunFailure,
  buildTestRunInput,
  classifyTestRunError,
  getTestRunBlocker,
} from "@/modules/ee/workflows/lib/test-run";
import { readStoredTestPayload } from "@/modules/ee/workflows/lib/webhook-trigger-panel";
import {
  isWorkflowDirtyAtom,
  isWorkflowSavingAtom,
  isWorkflowTransitioningAtom,
  workflowAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";
import { editorRunDrawerAtom } from "@/modules/ee/workflows/state/run-drawer";

/** Why a Test run did not start or failed: a refusal, or the draft could not be saved first. */
export type TWorkflowTestRunFailure = TTestRunFailure | "unsaved";

/**
 * Test run from the editor header (ED6, ADR 0049): saves the draft if needed, sends the test
 * payload kept in this browser (else the server uses the Sample payload), and opens the run drawer
 * on the finished run. The run goes into the query cache, never into component state; the drawer
 * atom only holds which run is shown.
 */
export const useWorkflowTestRun = ({
  workflowId,
  isReadOnly,
}: {
  workflowId: string;
  isReadOnly: boolean;
}) => {
  const store = useStore();
  const queryClient = useQueryClient();
  const [drawer, setDrawer] = useAtom(editorRunDrawerAtom);
  const [preflightFailure, setPreflightFailure] = useState<TWorkflowTestRunFailure | null>(null);
  const { save } = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });

  const mutation = useMutation({
    mutationFn: (input: TCreateWorkflowTestRunInput) => createWorkflowTestRun(workflowId, input),
    onSuccess: (run) => {
      queryClient.setQueryData(workflowRunKeys.detail(run.id), run);
      void queryClient.invalidateQueries({ queryKey: workflowRunKeys.lists() });
      // A run that comes back after the drawer was closed stays closed; it is listed under Runs.
      setDrawer((current) => (current.isOpen ? { isOpen: true, runId: run.id } : current));
    },
  });
  const { mutate, reset } = mutation;

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

  const startTestRun = useCallback(async () => {
    const workflow = store.get(workflowAtom);
    if (!workflow || isReadOnly || mutation.isPending) return;

    reset();
    setPreflightFailure(null);
    setDrawer({ isOpen: true, runId: null });

    const definition = store.get(workflowDefinitionAtom);
    const blocker = getTestRunBlocker({
      triggerType: definition?.trigger?.triggerType ?? null,
      status: workflow.status,
    });
    if (blocker) {
      setPreflightFailure(blocker);
      return;
    }

    await waitForSaveToSettle();
    if (store.get(isWorkflowDirtyAtom) && !(await save({ silent: true }))) {
      setPreflightFailure("unsaved");
      return;
    }

    const built = buildTestRunInput(readStoredTestPayload(workflowId));
    if (!built.ok) {
      setPreflightFailure(built.reason);
      return;
    }
    mutate(built.input);
  }, [
    store,
    isReadOnly,
    mutation.isPending,
    reset,
    setDrawer,
    waitForSaveToSettle,
    save,
    workflowId,
    mutate,
  ]);

  const closeDrawer = useCallback(() => setDrawer({ isOpen: false, runId: null }), [setDrawer]);

  const failure: TWorkflowTestRunFailure | null =
    preflightFailure ??
    (mutation.error
      ? classifyTestRunError(mutation.error, { sentPayload: mutation.variables?.payload !== undefined })
      : null);

  return {
    startTestRun,
    closeDrawer,
    isDrawerOpen: drawer.isOpen,
    runId: drawer.runId,
    isRunning: mutation.isPending,
    failure,
    error: mutation.error,
  };
};
