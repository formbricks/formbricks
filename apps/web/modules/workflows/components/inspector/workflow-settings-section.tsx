"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { InspectorSection } from "@/modules/workflows/components/inspector/workflow-inspector-section";
import {
  setWorkflowDescriptionAtom,
  setWorkflowNameAtom,
  workflowDescriptionAtom,
  workflowNameAtom,
} from "@/modules/workflows/state/editor";

interface SettingsSectionProps {
  canEditMetadata: boolean;
}

export const SettingsSection = ({ canEditMetadata }: Readonly<SettingsSectionProps>) => {
  const { t } = useTranslation();
  const workflowName = useAtomValue(workflowNameAtom);
  const workflowDescription = useAtomValue(workflowDescriptionAtom);
  const setWorkflowName = useSetAtom(setWorkflowNameAtom);
  const setWorkflowDescription = useSetAtom(setWorkflowDescriptionAtom);

  return (
    <InspectorSection title={t("workspace.workflows.settings_title")} defaultOpen>
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
              "flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:text-slate-300"
            )}
            placeholder={t("workspace.workflows.workflow_description_placeholder")}
            onChange={(event) => setWorkflowDescription(event.target.value)}
          />
        </div>
      </div>
    </InspectorSection>
  );
};
