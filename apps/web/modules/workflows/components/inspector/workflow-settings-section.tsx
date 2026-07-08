"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import {
  setWorkflowDescriptionAtom,
  setWorkflowNameAtom,
  workflowDescriptionAtom,
  workflowNameAtom,
} from "@/modules/workflows/state/editor";

interface SettingsSectionProps {
  workflowId: string;
  isReadOnly: boolean;
  canEditMetadata: boolean;
}

export const SettingsSection = ({
  workflowId,
  isReadOnly,
  canEditMetadata,
}: Readonly<SettingsSectionProps>) => {
  const { t } = useTranslation();
  const workflowName = useAtomValue(workflowNameAtom);
  const workflowDescription = useAtomValue(workflowDescriptionAtom);
  const setWorkflowName = useSetAtom(setWorkflowNameAtom);
  const setWorkflowDescription = useSetAtom(setWorkflowDescriptionAtom);
  const builder = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  const handleArchiveConfirm = async () => {
    await builder.archive();
    setIsArchiveModalOpen(false);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">
        {t("workspace.workflows.settings_title")}
      </h2>
      <div className="flex flex-col gap-4 border-t border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="workflow-settings-name">{t("workspace.workflows.workflow_name_label")}</Label>
          <Input
            id="workflow-settings-name"
            value={workflowName}
            disabled={!canEditMetadata}
            className="bg-white"
            onChange={(event) => setWorkflowName(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="workflow-settings-description">
            {t("workspace.workflows.workflow_description_label")}
          </Label>
          <textarea
            id="workflow-settings-description"
            value={workflowDescription}
            disabled={!canEditMetadata}
            rows={3}
            className={cn(
              "flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-dark focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
            )}
            placeholder={t("workspace.workflows.workflow_description_placeholder")}
            onChange={(event) => setWorkflowDescription(event.target.value)}
          />
        </div>

        <div className="flex flex-col border-t border-slate-200 pt-4">
          {builder.isArchived ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={builder.unarchive}
              loading={builder.isTransitioning}
              disabled={isReadOnly || builder.isTransitioning || builder.isSaving}>
              {t("common.unarchive")}
              <ArchiveRestoreIcon />
            </Button>
          ) : (
            // The confirmation modal owns the spinner, so this button only disables while
            // another lifecycle action runs.
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => setIsArchiveModalOpen(true)}
              disabled={isReadOnly || builder.isTransitioning || builder.isSaving}>
              {t("common.archive")}
              <ArchiveIcon />
            </Button>
          )}
        </div>
      </div>

      <ConfirmationModal
        open={isArchiveModalOpen}
        setOpen={setIsArchiveModalOpen}
        title={t("workspace.workflows.archive_confirm_title")}
        body={t("workspace.workflows.archive_confirm_body")}
        buttonText={t("common.archive")}
        buttonVariant="destructive"
        buttonLoading={builder.isTransitioning}
        isButtonDisabled={isReadOnly || builder.isTransitioning}
        onConfirm={handleArchiveConfirm}
        Icon={ArchiveIcon}
      />
    </section>
  );
};
