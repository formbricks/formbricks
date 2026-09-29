"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import type { surveyKeys } from "@/modules/survey/list/lib/query";
import { RestrictConfirmationDialog } from "@/modules/survey/visibility/components/restrict-confirmation-dialog";
import { useSurveyVisibility } from "@/modules/survey/visibility/hooks/use-survey-visibility";
import { useUpdateSurveyVisibility } from "@/modules/survey/visibility/hooks/use-update-survey-visibility";
import { useVisibilityCopy } from "@/modules/survey/visibility/hooks/use-visibility-copy";
import {
  canSaveVisibility,
  getDisplayedVisibility,
  getRestrictedAuthor,
  getVisibilityErrorReaction,
  needsRestrictConfirmation,
} from "@/modules/survey/visibility/lib/collaborate";
import { SURVEY_VISIBILITY_DOCS_URL } from "@/modules/survey/visibility/lib/constants";
import { Badge } from "@/modules/ui/components/badge";
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
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface CollaborateModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  surveyId: string;
  surveyName: string;
  workspaceName: string;
  /** The survey list's query, patched optimistically. The editor passes none. */
  listQueryKey?: ReturnType<typeof surveyKeys.list>;
  /** The stored visibility after a successful (or pending) change. */
  onVisibilityChanged?: (visibility: TSurveyVisibility) => void;
  /** The feature turned out to be off for this organization: hide every visibility control. */
  onVisibilityNotEnabled: () => void;
}

const VISIBILITY_OPTIONS: readonly TSurveyVisibility[] = ["restricted", "workspace"];

/**
 * Scope 1 of Collaborate: who can see the survey, as one of two values. The slots below the select
 * are reserved for named sharing and stay empty until it ships.
 */
export const CollaborateModal = ({
  open,
  setOpen,
  surveyId,
  surveyName,
  workspaceName,
  listQueryKey,
  onVisibilityChanged,
  onVisibilityNotEnabled,
}: Readonly<CollaborateModalProps>) => {
  const { t } = useTranslation();
  const visibilityQuery = useSurveyVisibility({ surveyId, enabled: open });
  const updateVisibility = useUpdateSurveyVisibility({ listQueryKey });
  // `null` until the user picks something: the select then shows the current value.
  const [picked, setPicked] = useState<TSurveyVisibility | null>(null);
  const [isRestrictDialogOpen, setIsRestrictDialogOpen] = useState(false);

  const state = visibilityQuery.data;
  const current = state ? getDisplayedVisibility(state) : null;
  const selected = picked ?? current;
  const author = getRestrictedAuthor(state?.access ?? null, state?.owner?.name ?? null);
  const copy = useVisibilityCopy({ workspaceName, author });
  const allowedTargets = state?.allowedTargets ?? [];
  const isSaveEnabled = current !== null && canSaveVisibility({ current, selected, allowedTargets });
  const loadErrorReaction = visibilityQuery.isError
    ? getVisibilityErrorReaction(visibilityQuery.error)
    : null;

  useEffect(() => {
    if (open && loadErrorReaction === "hide_controls") {
      setOpen(false);
      onVisibilityNotEnabled();
    }
  }, [open, loadErrorReaction, onVisibilityNotEnabled, setOpen]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setPicked(null);
    setOpen(next);
  };

  const closeAll = () => {
    setIsRestrictDialogOpen(false);
    handleOpenChange(false);
  };

  const saveVisibility = async (target: TSurveyVisibility) => {
    try {
      const result = await updateVisibility.mutateAsync({ surveyId, visibility: target });
      toast.success(t("workspace.surveys.visibility.visibility_updated"));
      onVisibilityChanged?.(result.pending ?? result.visibility);
      closeAll();
    } catch (error) {
      const message = getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"));
      switch (getVisibilityErrorReaction(error)) {
        case "pending":
          toast.success(t("workspace.surveys.visibility.visibility_update_pending"));
          onVisibilityChanged?.(target);
          closeAll();
          break;
        case "hide_controls":
          toast.error(message);
          closeAll();
          onVisibilityNotEnabled();
          break;
        case "refetch_blockers":
          toast.error(message);
          await visibilityQuery.refetch();
          break;
        default:
          toast.error(message);
      }
    }
  };

  const handleSave = () => {
    if (!selected) return;
    if (needsRestrictConfirmation(selected)) {
      setIsRestrictDialogOpen(true);
      return;
    }
    void saveVisibility(selected);
  };

  const optionLabel = (value: TSurveyVisibility) =>
    value === "restricted" ? copy.restrictedLabel : copy.workspaceLabel;
  const optionDescription = (value: TSurveyVisibility) =>
    value === "restricted" ? copy.restrictedDescription : copy.workspaceDescription;

  return (
    <>
      <Dialog open={open && !isRestrictDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent width="narrow">
          <DialogHeader>
            <DialogTitle>{t("common.collaborate")}</DialogTitle>
            <DialogDescription className="truncate">{surveyName}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-2">
            <Label htmlFor={`survey-visibility-${surveyId}`}>{t("common.visibility")}</Label>
            <Select
              value={selected ?? undefined}
              disabled={!state}
              onValueChange={(value) => {
                const option = VISIBILITY_OPTIONS.find((candidate) => candidate === value);
                if (option) setPicked(option);
              }}>
              <SelectTrigger id={`survey-visibility-${surveyId}`}>
                <SelectValue>{selected ? optionLabel(selected) : null}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((value) => {
                  const isAvailable = value === current || allowedTargets.includes(value);
                  return (
                    <SelectItem key={value} value={value} disabled={!isAvailable} className="py-2">
                      <span className="flex max-w-sm flex-col gap-0.5 whitespace-normal">
                        <span className="flex items-center gap-2 text-slate-800">
                          {optionLabel(value)}
                          {!isAvailable && (
                            <Badge
                              text={t("workspace.surveys.visibility.unavailable")}
                              type="gray"
                              size="tiny"
                            />
                          )}
                        </span>
                        <span className="text-xs font-normal text-slate-500">{optionDescription(value)}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {state?.pending && (
              <p className="text-xs text-slate-500">
                {t("workspace.surveys.visibility.visibility_update_pending")}
              </p>
            )}
            {loadErrorReaction === "show_error" && (
              <p className="text-xs text-red-600">
                {getV3ApiErrorMessage(
                  visibilityQuery.error,
                  t("common.something_went_wrong_please_try_again")
                )}
              </p>
            )}
            {/* Reserved for named sharing (later scopes): "Add people, teams, roles", suggestion chips,
                "People with access" and "Remove all access". Nothing renders here until then. */}
          </DialogBody>

          <DialogFooter className="sm:justify-between">
            <a
              href={SURVEY_VISIBILITY_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 self-center text-sm text-slate-500 underline-offset-4 hover:text-slate-800 hover:underline">
              {t("common.learn_more")}
              <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
            </a>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                {t("common.close")}
              </Button>
              <Button
                disabled={!isSaveEnabled}
                loading={updateVisibility.isPending && !isRestrictDialogOpen}
                onClick={handleSave}>
                {t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RestrictConfirmationDialog
        open={open && isRestrictDialogOpen}
        setOpen={(next) => {
          // "Keep visible" is a decision, not a dismissal: drop the pending Restricted choice too.
          if (!next) setPicked(null);
          setIsRestrictDialogOpen(next);
        }}
        workspaceName={workspaceName}
        author={author}
        impact={state?.impact ?? null}
        blockers={state?.blockers ?? []}
        isSubmitting={updateVisibility.isPending}
        onConfirm={() => void saveVisibility("restricted")}
      />
    </>
  );
};
