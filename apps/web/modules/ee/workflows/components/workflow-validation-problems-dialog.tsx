"use client";

import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { getWorkflowValidationProblemLocation } from "@/modules/ee/workflows/lib/display";
import {
  type TWorkflowValidationProblem,
  type TWorkflowValidationProblemCode,
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
 */
export const WorkflowValidationProblemsDialog = ({
  open,
  onOpenChange,
  problems,
}: Readonly<WorkflowValidationProblemsDialogProps>) => {
  const { t } = useTranslation();
  // Read for display only: resolving each problem's `field` to the affected node's title.
  const definition = useAtomValue(workflowDefinitionAtom);

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
              return (
                <li
                  key={`${problem.code}-${problem.field}`}
                  className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-800">{problemMessages[problem.code]}</p>
                  {location ? <p className="mt-1 text-xs text-slate-500">{location}</p> : null}
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
