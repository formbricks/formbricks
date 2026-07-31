"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArrowRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getWorkflowValidationProblemFocusTarget,
  getWorkflowValidationProblemLocation,
} from "@/modules/ee/workflows/lib/display";
import {
  type TWorkflowValidationProblem,
  type TWorkflowValidationProblemCode,
  requestWorkflowNodeFieldFocusAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface WorkflowValidationProblemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problems: TWorkflowValidationProblem[];
}

/**
 * Lists the live validation problems behind the canvas's "N errors" indicator. Only ever opened
 * with a non-empty list (a valid workflow renders a passive badge instead). Each problem is
 * localized by its `code`; the exhaustive map keeps a new code from shipping without copy.
 *
 * A problem that resolves to a single config field is a button: it closes the dialog, opens that
 * step's config panel, and focuses the offending field with its inline error revealed. Problems
 * fixed elsewhere (naming the workflow, adding a trigger, connecting the flow) stay passive rows —
 * there is nothing to focus.
 */
export const WorkflowValidationProblemsDialog = ({
  open,
  onOpenChange,
  problems,
}: Readonly<WorkflowValidationProblemsDialogProps>) => {
  const { t } = useTranslation();
  // Read for display only: resolving each problem's `field` to the affected node's title.
  const definition = useAtomValue(workflowDefinitionAtom);
  const requestFieldFocus = useSetAtom(requestWorkflowNodeFieldFocusAtom);

  // Inline literal t() calls so the translation-key scanner detects the keys.
  const problemMessages: Record<TWorkflowValidationProblemCode, string> = {
    name_missing: t("workspace.workflows.validation_problem_name_missing"),
    trigger_missing: t("workspace.workflows.validation_problem_trigger_missing"),
    trigger_survey_unbound: t("workspace.workflows.validation_problem_trigger_survey_unbound"),
    trigger_ending_not_found: t("workspace.workflows.validation_problem_trigger_ending_not_found"),
    trigger_not_connected: t("workspace.workflows.validation_problem_trigger_not_connected"),
    flow_invalid: t("workspace.workflows.validation_problem_flow_invalid"),
    step_not_executable: t("workspace.workflows.validation_problem_step_not_executable"),
    step_incomplete: t("workspace.workflows.validation_problem_step_incomplete"),
    definition_invalid: t("workspace.workflows.validation_problem_generic"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workspace.workflows.validation_problems_title")}</DialogTitle>
          <DialogDescription>{t("workspace.workflows.validation_problems_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="space-y-3">
            {problems.map((problem) => {
              // The affected step's display title (as shown on its canvas card), when the
              // problem points at one; whole-flow problems carry no locator row at all.
              const location = getWorkflowValidationProblemLocation(problem, definition, t);
              const focusTarget = getWorkflowValidationProblemFocusTarget(problem, definition);
              const message = problemMessages[problem.code];

              return (
                <li key={`${problem.code}-${problem.field}`}>
                  {focusTarget ? (
                    <button
                      type="button"
                      aria-label={t("workspace.workflows.validation_problem_fix_label", { problem: message })}
                      className="focus-visible:ring-ring flex w-full items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-100 focus-visible:ring-1 focus-visible:outline-hidden"
                      onClick={() => {
                        onOpenChange(false);
                        requestFieldFocus(focusTarget);
                      }}>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm text-slate-800">{message}</span>
                        {location ? <span className="mt-1 text-xs text-slate-500">{location}</span> : null}
                      </span>
                      <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  ) : (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="text-sm text-slate-800">{message}</p>
                      {location ? <p className="mt-1 text-xs text-slate-500">{location}</p> : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
