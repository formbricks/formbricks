"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
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
          <Input
            id="workflow-settings-description"
            value={workflowDescription}
            disabled={!canEditMetadata}
            className="bg-white"
            placeholder={t("workspace.workflows.workflow_description_placeholder")}
            onChange={(event) => setWorkflowDescription(event.target.value)}
          />
        </div>
      </div>
    </InspectorSection>
  );
};
