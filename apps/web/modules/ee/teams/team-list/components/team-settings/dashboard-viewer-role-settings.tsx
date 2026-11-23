"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type TTeamDashboardLimitsResource,
  dashboardAccessQueryKeys,
  getTeamDashboardLimits,
} from "@/modules/ee/dashboard-access/lib/api-client";
import { Label } from "@/modules/ui/components/label";
import { AllChipMultiSelect } from "@/modules/ui/components/multi-select/all-chip-multi-select";
import { Muted } from "@/modules/ui/components/typography";
import { cn } from "@/modules/ui/lib/utils";

interface DashboardViewerRoleSettingsProps {
  /** Owners and Managers, decided on the server. */
  canEdit: boolean;
  /** The workspaces the form grants the team now: dashboards outside them are not offered. */
  selectedWorkspaceIds: string[];
  /** The saved limits and the dashboards they can name; `undefined` while they load. */
  limits: TTeamDashboardLimitsResource | undefined;
  /** The edit in progress; `null` while it matches the saved limits. */
  value: string[] | null;
  onChange: (dashboardIds: string[]) => void;
}

/** The saved limits, for the modal to compare its edit against on save. */
export const useTeamDashboardLimits = (teamId: string, enabled: boolean) =>
  useQuery<TTeamDashboardLimitsResource>({
    queryKey: dashboardAccessQueryKeys.team(teamId),
    queryFn: ({ signal }) => getTeamDashboardLimits(teamId, signal),
    enabled,
  });

/**
 * "Dashboard Viewer role settings" in a team's settings (ENG-7483), collapsed by default: which dashboards
 * the team's Dashboard Viewer members open in its workspaces. Empty is "All dashboards".
 */
export const DashboardViewerRoleSettings = ({
  canEdit,
  limits,
  selectedWorkspaceIds,
  value,
  onChange,
}: Readonly<DashboardViewerRoleSettingsProps>) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const labelId = useId();

  const options = useMemo(
    () =>
      (limits?.dashboards ?? [])
        .filter(({ workspaceId }) => selectedWorkspaceIds.includes(workspaceId))
        .map(({ id, name, workspaceName }) => ({ value: id, label: `${name} · ${workspaceName}` })),
    [limits?.dashboards, selectedWorkspaceIds]
  );
  const selected = (value ?? limits?.dashboardIds ?? []).filter((id) =>
    options.some((option) => option.value === id)
  );

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="rounded-md border border-slate-200">
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-slate-800">
          {t("workspace.settings.teams.dashboard_viewer_role_settings")}
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content className="space-y-2 border-t border-slate-200 px-3 py-3">
        <Label id={labelId}>{t("workspace.settings.teams.dashboard_access")}</Label>
        <AllChipMultiSelect
          ariaLabel={t("workspace.settings.teams.dashboard_access")}
          allLabel={t("workspace.settings.teams.all_dashboards")}
          placeholder={t("workspace.settings.teams.select_dashboards")}
          options={options}
          value={selected}
          onChange={onChange}
          disabled={!canEdit || !limits}
        />
        <Muted className="block text-slate-500">
          {t("workspace.settings.teams.dashboard_access_helper")}
        </Muted>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
