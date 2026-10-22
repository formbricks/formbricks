"use client";

import { type Dispatch, type SetStateAction, useId } from "react";
import { useTranslation } from "react-i18next";
import type {
  TSurveyStatusChangeKind,
  TSurveyStatusChangePlan,
} from "@/modules/ee/creatives/lib/survey-side";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { Label } from "@/modules/ui/components/label";
import { CreativeStatusPill } from "../creative-status-pill";

interface SurveyStatusChangeDialogProps {
  plan: TSurveyStatusChangePlan | null;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  keepPaused: boolean;
  setKeepPaused: (keepPaused: boolean) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

/**
 * Confirms pausing, closing or resuming a survey that creatives open, naming every one of them with its
 * status: pausing or closing the survey shows the ones on the site as Paused with its survey, and
 * resuming brings those back unless the author keeps them paused.
 */
export const SurveyStatusChangeDialog = ({
  plan,
  open,
  setOpen,
  keepPaused,
  setKeepPaused,
  onConfirm,
  isSubmitting,
}: Readonly<SurveyStatusChangeDialogProps>) => {
  const { t } = useTranslation();
  const keepPausedId = useId();
  const kind: TSurveyStatusChangeKind = plan?.kind ?? "pause";
  const copy: Record<TSurveyStatusChangeKind, { title: string; intro: string; button: string }> = {
    pause: {
      title: t("workspace.creatives.survey_side.pause_title"),
      intro: t("workspace.creatives.survey_side.pause_intro"),
      button: t("workspace.creatives.survey_side.pause_button"),
    },
    close: {
      title: t("workspace.creatives.survey_side.close_title"),
      intro: t("workspace.creatives.survey_side.close_intro"),
      button: t("workspace.creatives.survey_side.close_button"),
    },
    resume: {
      title: t("workspace.creatives.survey_side.resume_title"),
      intro: t("workspace.creatives.survey_side.resume_intro"),
      button: t("workspace.creatives.survey_side.resume_button"),
    },
  };

  return (
    <ConfirmationModal
      open={open}
      setOpen={setOpen}
      title={copy[kind].title}
      description={copy[kind].intro}
      body={
        <div className="space-y-3 text-sm whitespace-normal text-slate-700">
          {/* Every creative that opens it, each with its status, so drafts and paused ones are named too. */}
          <ul className="space-y-1">
            {plan?.creatives.map((creative) => (
              <li key={creative.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{creative.name}</span>
                <CreativeStatusPill
                  state={{ status: creative.displayStatus, reason: creative.displayStatusReason }}
                />
              </li>
            ))}
          </ul>
          {kind === "resume" && (plan?.affected.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id={keepPausedId}
                checked={keepPaused}
                onCheckedChange={(checked) => setKeepPaused(checked === true)}
                disabled={isSubmitting}
              />
              <Label htmlFor={keepPausedId} className="cursor-pointer font-normal">
                {t("workspace.creatives.survey_side.keep_paused")}
              </Label>
            </div>
          )}
        </div>
      }
      buttonText={copy[kind].button}
      buttonVariant="default"
      buttonLoading={isSubmitting}
      onConfirm={onConfirm}
    />
  );
};
