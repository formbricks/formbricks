"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { InspectorSection } from "@/modules/workflows/components/inspector/workflow-inspector-section";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import type { TWorkflowOperationalSettings } from "@/modules/workflows/lib/placeholder-data";
import {
  setWorkflowDescriptionAtom,
  setWorkflowNameAtom,
  workflowAtom,
  workflowDescriptionAtom,
  workflowNameAtom,
} from "@/modules/workflows/state/editor";

interface SettingsSectionProps {
  workflowId: string;
  isReadOnly: boolean;
  canEditDefinition: boolean;
  canEditMetadata: boolean;
  settings?: TWorkflowOperationalSettings;
}

export const SettingsSection = ({
  workflowId,
  isReadOnly,
  canEditDefinition,
  canEditMetadata,
  settings,
}: Readonly<SettingsSectionProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const workflowName = useAtomValue(workflowNameAtom);
  const workflowDescription = useAtomValue(workflowDescriptionAtom);
  const setWorkflowName = useSetAtom(setWorkflowNameAtom);
  const setWorkflowDescription = useSetAtom(setWorkflowDescriptionAtom);
  const builder = useWorkflowBuilder({ workflowId, isReadOnly, loadOnMount: false });

  const [capRunsEnabled, setCapRunsEnabled] = useState(settings?.capRunsEnabled ?? false);
  const [capRunsLimit, setCapRunsLimit] = useState(settings?.capRunsLimit ?? "10");
  const [capRunsUnit, setCapRunsUnit] = useState<TWorkflowOperationalSettings["capRunsUnit"]>(
    settings?.capRunsUnit ?? "day"
  );

  const isArchived = workflow?.status === "archived";
  const isActive = workflow?.status === "enabled";

  const handleActiveChange = (checked: boolean) => {
    if (checked) {
      builder.enable();
    } else {
      builder.disable();
    }
  };

  return (
    <InspectorSection title={t("workspace.workflows.settings_title")}>
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

        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
          <div className="flex flex-col">
            <Label htmlFor="workflow-settings-active" className="text-sm font-medium">
              {t("workspace.workflows.active_label")}
            </Label>
            <span className="text-xs text-slate-500">{t("workspace.workflows.active_description")}</span>
          </div>
          <Switch
            id="workflow-settings-active"
            checked={isActive}
            disabled={isReadOnly || isArchived || builder.isTransitioning}
            onCheckedChange={handleActiveChange}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="workflow-settings-cap-runs"
            checked={capRunsEnabled}
            disabled={!canEditDefinition}
            onCheckedChange={setCapRunsEnabled}
          />
          <Label htmlFor="workflow-settings-cap-runs" className="text-sm font-medium">
            {t("workspace.workflows.cap_runs_label")}
          </Label>
        </div>
        {capRunsEnabled ? (
          <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">
                {t("workspace.workflows.cap_runs_at_label")}
              </span>
              <Input
                type="number"
                min={1}
                className="bg-white"
                value={capRunsLimit}
                disabled={!canEditDefinition}
                onChange={(event) => setCapRunsLimit(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">
                {t("workspace.workflows.cap_runs_per_label")}
              </span>
              <Select
                value={capRunsUnit}
                disabled={!canEditDefinition}
                onValueChange={(value) =>
                  setCapRunsUnit(value as TWorkflowOperationalSettings["capRunsUnit"])
                }>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">{t("workspace.workflows.cap_runs_unit_hour")}</SelectItem>
                  <SelectItem value="day">{t("workspace.workflows.cap_runs_unit_day")}</SelectItem>
                  <SelectItem value="week">{t("workspace.workflows.cap_runs_unit_week")}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        ) : null}
      </div>
    </InspectorSection>
  );
};
