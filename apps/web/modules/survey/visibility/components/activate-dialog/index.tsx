"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { useVisibilityCopy } from "@/modules/survey/visibility/hooks/use-visibility-copy";
import type { TRestrictedAuthor } from "@/modules/survey/visibility/lib/collaborate";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { RadioGroup, RadioGroupItem } from "@/modules/ui/components/radio-group";

interface ActivateDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  workspaceName: string;
  author: TRestrictedAuthor;
  /** A publish date is set: the primary action schedules instead of activating now. */
  isScheduling: boolean;
  isSubmitting?: boolean;
  onConfirm: (choice: TSurveyVisibility) => void;
}

const CHOICES: readonly TSurveyVisibility[] = ["restricted", "workspace"];

type TActivateDialogBodyProps = Omit<ActivateDialogProps, "open">;

// Lives inside the dialog content, which unmounts on close: every opening starts without a choice,
// so the answer is always given, never inherited from an earlier attempt.
const ActivateDialogBody = ({
  setOpen,
  workspaceName,
  author,
  isScheduling,
  isSubmitting = false,
  onConfirm,
}: Readonly<TActivateDialogBodyProps>) => {
  const { t } = useTranslation();
  const copy = useVisibilityCopy({ workspaceName, author });
  const [choice, setChoice] = useState<TSurveyVisibility | null>(null);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("workspace.surveys.visibility.activate_dialog_title")}</DialogTitle>
      </DialogHeader>

      <DialogBody>
        <RadioGroup
          className="gap-y-3"
          value={choice ?? ""}
          aria-label={t("workspace.surveys.visibility.activate_dialog_title")}
          onValueChange={(value) => {
            const next = CHOICES.find((candidate) => candidate === value);
            if (next) setChoice(next);
          }}>
          {CHOICES.map((value) => {
            const id = `activate-visibility-${value}`;
            return (
              <label
                key={value}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50",
                  choice === value && "border-slate-400 bg-slate-50"
                )}>
                <RadioGroupItem id={id} value={value} className="mt-0.5 shrink-0" />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-slate-800">
                    {value === "restricted" ? copy.restrictedLabel : copy.workspaceLabel}
                  </span>
                  <span className="text-sm text-slate-500">
                    {value === "restricted" ? copy.restrictedDescription : copy.workspaceDescription}
                  </span>
                </span>
              </label>
            );
          })}
        </RadioGroup>
      </DialogBody>

      <DialogFooter>
        <Button variant="secondary" disabled={isSubmitting} onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
        <Button
          disabled={choice === null}
          loading={isSubmitting}
          onClick={() => {
            if (choice) onConfirm(choice);
          }}>
          {isScheduling ? t("workspace.surveys.edit.schedule_survey") : t("workspace.surveys.edit.publish")}
        </Button>
      </DialogFooter>
    </>
  );
};

/**
 * Asked once, when a restricted survey is activated or scheduled — never when a schedule fires.
 * Nothing is preselected: the choice is deliberate, so the primary action waits for one.
 */
export const ActivateDialog = ({ open, ...bodyProps }: Readonly<ActivateDialogProps>) => (
  <Dialog open={open} onOpenChange={(next) => !bodyProps.isSubmitting && bodyProps.setOpen(next)}>
    <DialogContent width="narrow">
      <ActivateDialogBody {...bodyProps} />
    </DialogContent>
  </Dialog>
);
