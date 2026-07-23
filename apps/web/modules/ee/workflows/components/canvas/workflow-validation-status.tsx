"use client";

import { useAtomValue } from "jotai";
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { useWorkflowSurveyEndings } from "@/modules/ee/workflows/list/hooks/use-trigger-survey-picker";
import {
  deriveTriggerEndingProblems,
  workflowAtom,
  workflowDefinitionAtom,
  workflowValidationProblemsAtom,
} from "@/modules/ee/workflows/state/editor";
import { WorkflowValidationProblemsDialog } from "../workflow-validation-problems-dialog";

// Same pill geometry as the Badge component (which only renders plain text, hence hand-rolled
// here: both states carry an icon and the invalid one is a real button).
const PILL_CLASS_NAME =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium";

/**
 * Always-on validation state for the loaded workflow, floating in the canvas's bottom-right
 * corner (the canvas controls own bottom-center). Valid renders as a passive badge; problems
 * render as a real button that opens the problems dialog. There is no manual trigger — the
 * problem list recomputes live on every edit via workflowValidationProblemsAtom.
 */
export const WorkflowValidationStatus = () => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const atomProblems = useAtomValue(workflowValidationProblemsAtom);
  const [isProblemsDialogOpen, setIsProblemsDialogOpen] = useState(false);

  // The ending-cards check is the one readiness rule that needs server data (the bound survey's
  // current endings), so it is merged here at the component level — query results stay in the
  // TanStack cache, never mirrored into Jotai. Consequence: the header's Enable gate
  // (workflowValidityAtom.isReady) deliberately excludes ending problems; the server's enable
  // pre-flight still rejects stale endings.
  const trigger = definition?.trigger ?? null;
  const endingsQuery = useWorkflowSurveyEndings(trigger?.config.surveyId ?? null);
  // Only a successfully RESOLVED endings list may flag a problem. While the query is loading,
  // disabled (no trigger/survey), or errored (e.g. a read-only viewer's 403, an unbound survey's
  // 404), the check is skipped silently — unknown must never render as an error.
  const endingProblems =
    trigger && endingsQuery.isSuccess
      ? deriveTriggerEndingProblems(
          trigger.config.endingCardIds,
          endingsQuery.endings.map((ending) => ending.id)
        )
      : [];
  const problems = [...atomProblems, ...endingProblems];

  // Nothing to report until the editor is hydrated.
  if (!workflow) return null;

  return (
    // Polite live region so validity flips are announced without interrupting the user's editing.
    <div className="absolute right-4 bottom-4 z-10" aria-live="polite">
      {problems.length === 0 ? (
        <span className={cn(PILL_CLASS_NAME, "cursor-default border-green-600 bg-green-50 text-green-800")}>
          <CheckIcon className="size-3.5" aria-hidden="true" />
          {t("workspace.workflows.validation_status_valid")}
        </span>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          className={cn(
            PILL_CLASS_NAME,
            "border-red-200 bg-red-100 text-red-800 transition-colors hover:bg-red-200",
            "focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-hidden"
          )}
          onClick={() => setIsProblemsDialogOpen(true)}>
          <XIcon className="size-3.5" aria-hidden="true" />
          {t("workspace.workflows.validation_error_count", { count: problems.length })}
        </button>
      )}
      <WorkflowValidationProblemsDialog
        open={isProblemsDialogOpen}
        onOpenChange={setIsProblemsDialogOpen}
        problems={problems}
      />
    </div>
  );
};
