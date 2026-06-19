"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/modules/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { InspectorSection } from "@/modules/workflows/components/workflow-inspector-section";
import type { TWorkflowOperationalSettings } from "@/modules/workflows/lib/placeholder-data";

interface SettingsSectionProps {
  settings?: TWorkflowOperationalSettings;
}

/**
 * Operational settings (currently just the cap-runs rate limit). Reads initial values from the
 * passed-in settings snapshot; edits live in local state until the real persistence API lands.
 */
export const SettingsSection = ({ settings }: Readonly<SettingsSectionProps>) => {
  const { t } = useTranslation();
  const [capRunsEnabled, setCapRunsEnabled] = useState(settings?.capRunsEnabled ?? false);
  const [capRunsLimit, setCapRunsLimit] = useState(settings?.capRunsLimit ?? "10");
  const [capRunsUnit, setCapRunsUnit] = useState<TWorkflowOperationalSettings["capRunsUnit"]>(
    settings?.capRunsUnit ?? "day"
  );

  return (
    <InspectorSection title={t("workspace.workflows.settings_title")}>
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch checked={capRunsEnabled} onCheckedChange={setCapRunsEnabled} />
          <span className="text-sm font-medium text-slate-700">
            {t("workspace.workflows.cap_runs_label")}
          </span>
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
                onChange={(event) => setCapRunsLimit(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">
                {t("workspace.workflows.cap_runs_per_label")}
              </span>
              <Select
                value={capRunsUnit}
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
