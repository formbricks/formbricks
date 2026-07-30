"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TWorkflowResponseCompletedTriggerNode } from "@formbricks/workflows";
import { reconcileEndingCardIds } from "@/modules/ee/workflows/lib/trigger-ending-cards";
import {
  useWorkflowSurveyEndings,
  useWorkflowSurveyOptions,
} from "@/modules/ee/workflows/list/hooks/use-trigger-survey-picker";
import { prunedTriggerEndingCardIdsAtom } from "@/modules/ee/workflows/state/editor";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface WorkflowTriggerFormProps {
  node: TWorkflowResponseCompletedTriggerNode;
  isEditable: boolean;
  onChange: (next: TWorkflowResponseCompletedTriggerNode) => void;
}

// "all" = empty `endingCardIds` (match any ending, including future ones); "specific" = checkbox list.
type TEndingScope = "all" | "specific";

export const WorkflowTriggerForm = ({ node, isEditable, onChange }: Readonly<WorkflowTriggerFormProps>) => {
  const { t } = useTranslation();
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? "";
  const surveyOptionsQuery = useWorkflowSurveyOptions(workspaceId);
  const triggerSurveyId = node.config.surveyId || null;
  const endingsQuery = useWorkflowSurveyEndings(triggerSurveyId);

  // Only an authority once the query has SETTLED for the current survey; null until then, so a
  // pending fetch never reads as "no endings" and the stored ids are taken at face value.
  const surveyEndingIds =
    endingsQuery.isSuccess && endingsQuery.resolvedSurveyId === triggerSurveyId
      ? endingsQuery.endings.map((ending) => ending.id)
      : null;
  // Open in "specific" scope when ids are set OR the builder page pruned this trigger's picks: the
  // user chose specific endings that are now gone, so ask for a fresh pick instead of showing the
  // widened "all endings" state. Atom (not a prop) since it's trigger-specific.
  const prunedEndingCardIds = useAtomValue(prunedTriggerEndingCardIdsAtom);
  const setPrunedEndingCardIds = useSetAtom(prunedTriggerEndingCardIdsAtom);
  const [endingScope, setEndingScope] = useState<TEndingScope>(
    node.config.endingCardIds.length > 0 || prunedEndingCardIds.length > 0 ? "specific" : "all"
  );

  const handleSurveyChange = (surveyId: string) => {
    // Clear ending selection when survey changes — ids belong to the previous survey's endings.
    setEndingScope("all");
    // Pruned ids belonged to the previous survey, so the prompt they raised is moot.
    setPrunedEndingCardIds([]);
    onChange({
      ...node,
      config: { ...node.config, surveyId, endingCardIds: [] },
    });
  };

  const handleScopeChange = (scope: TEndingScope) => {
    setEndingScope(scope);
    // Any deliberate scope pick answers the "your endings were pruned, choose again" prompt, so
    // stop replaying it. Cleared for BOTH directions and unconditionally: after a full prune
    // `endingCardIds` is already empty, so picking "all" writes nothing — leaving the atom set
    // would make the form snap back to "specific" on its next remount and discard that choice.
    setPrunedEndingCardIds([]);
    if (scope === "all" && node.config.endingCardIds.length > 0) {
      onChange({ ...node, config: { ...node.config, endingCardIds: [] } });
    }
  };

  const toggleEnding = (endingId: string, checked: boolean) => {
    // Reconcile before applying the click so ids from deleted endings can't ride along (that
    // appending is what produced the phantom "trigger on 2 ending cards" after picking one).
    const current = surveyEndingIds
      ? reconcileEndingCardIds(node.config.endingCardIds, surveyEndingIds).endingCardIds
      : node.config.endingCardIds;
    const next = checked
      ? Array.from(new Set([...current, endingId]))
      : current.filter((id) => id !== endingId);
    onChange({ ...node, config: { ...node.config, endingCardIds: next } });
  };

  // An empty `endingCardIds` means "every ending fires this workflow", which is a widening whenever
  // the user's intent is — or was, before the prune — a specific set. Keyed off the pruned atom too
  // so it still shows when the prune emptied the list and the survey has no endings left to check.
  const showFiresOnEveryEndingNotice =
    node.config.endingCardIds.length === 0 && (endingScope === "specific" || prunedEndingCardIds.length > 0);

  const renderEndingChoices = () => {
    if (!node.config.surveyId) {
      return (
        <p className="text-xs text-slate-500">{t("workspace.workflows.trigger_ending_cards_pick_survey")}</p>
      );
    }
    if (endingsQuery.isLoading) {
      return <p className="text-xs text-slate-500">{t("common.loading")}</p>;
    }
    // No endings on the survey: say so in place of the checkbox list, but keep the scope select and
    // the every-ending notice below reachable. Returning early here hid both, so a prune that
    // emptied the selection widened the trigger to every response with nothing on screen saying so
    // (the validity pill has nothing to flag either — the stale ids are gone by then).
    const renderEndingSelection = () => {
      if (endingsQuery.endings.length === 0) {
        return <p className="text-xs text-slate-500">{t("workspace.workflows.trigger_ending_cards_none")}</p>;
      }
      if (endingScope !== "specific") return null;
      return (
        <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md border border-slate-200 bg-white px-3 py-2">
          {endingsQuery.endings.map((ending) => {
            const checked = node.config.endingCardIds.includes(ending.id);
            return (
              <label
                key={ending.id}
                className="flex items-center gap-2 text-sm text-slate-700"
                htmlFor={`workflow-trigger-ending-${ending.id}`}>
                <Checkbox
                  id={`workflow-trigger-ending-${ending.id}`}
                  checked={checked}
                  disabled={!isEditable}
                  onCheckedChange={(value) => toggleEnding(ending.id, value === true)}
                />
                <span className="truncate">{ending.label}</span>
              </label>
            );
          })}
        </div>
      );
    };

    return (
      <>
        <Select
          value={endingScope}
          onValueChange={(value) => handleScopeChange(value as TEndingScope)}
          disabled={!isEditable}>
          <SelectTrigger id="workflow-trigger-ending-scope" className="bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("workspace.workflows.trigger_ending_cards_scope_all")}</SelectItem>
            <SelectItem value="specific">
              {t("workspace.workflows.trigger_ending_cards_scope_specific")}
            </SelectItem>
          </SelectContent>
        </Select>
        {renderEndingSelection()}
        {showFiresOnEveryEndingNotice ? (
          <p className="text-xs text-slate-500">
            {t("workspace.workflows.trigger_ending_cards_select_at_least_one")}
          </p>
        ) : null}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4 px-1">
      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-trigger-survey">{t("workspace.workflows.trigger_survey_label")}</Label>
        <Select
          value={node.config.surveyId || undefined}
          onValueChange={handleSurveyChange}
          disabled={!isEditable || surveyOptionsQuery.isLoading}>
          <SelectTrigger id="workflow-trigger-survey" className="bg-white">
            <SelectValue placeholder={t("workspace.workflows.trigger_survey_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {surveyOptionsQuery.options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                {surveyOptionsQuery.isLoading
                  ? t("common.loading")
                  : t("workspace.workflows.trigger_survey_empty")}
              </div>
            ) : (
              surveyOptionsQuery.options.map((survey) => (
                <SelectItem key={survey.id} value={survey.id}>
                  {survey.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">{t("workspace.workflows.trigger_survey_description")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="workflow-trigger-ending-scope">
          {t("workspace.workflows.trigger_ending_cards_label")}
        </Label>
        {renderEndingChoices()}
      </div>
    </div>
  );
};
