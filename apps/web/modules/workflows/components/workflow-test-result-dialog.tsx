"use client";

import { useTranslation } from "react-i18next";
import type { TWorkflowTestProblem } from "@formbricks/workflows";
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

interface WorkflowTestResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problems: TWorkflowTestProblem[];
}

/**
 * Shows the problems from a dry-run test (`POST /test`) when the workflow is not ready. The success
 * case is a toast, so this dialog only ever renders a non-empty problem list. Each problem's
 * `message` and `field` come straight from the API.
 */
export const WorkflowTestResultDialog = ({
  open,
  onOpenChange,
  problems,
}: Readonly<WorkflowTestResultDialogProps>) => {
  const { t } = useTranslation();

  // Localize each problem by its machine-readable `code` rather than rendering the API's English
  // `message`. Inline literal t() calls so the translation-key scanner detects the keys.
  const problemMessages: Record<string, string> = {
    definition_not_executable: t("workspace.workflows.test_problem_not_executable"),
    survey_not_found: t("workspace.workflows.test_problem_survey_not_found"),
    ending_card_not_found: t("workspace.workflows.test_problem_ending_card_not_found"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("workspace.workflows.test_problems_title")}</DialogTitle>
          <DialogDescription>{t("workspace.workflows.test_problems_description")}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="space-y-3">
            {problems.map((problem, index) => (
              <li
                key={`${problem.code}-${problem.field}-${index.toString()}`}
                className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-800">
                  {problemMessages[problem.code] ?? t("workspace.workflows.test_problem_generic")}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">{problem.field}</p>
              </li>
            ))}
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
