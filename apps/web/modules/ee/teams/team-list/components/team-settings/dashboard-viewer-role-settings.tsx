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
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { TabToggle } from "@/modules/ui/components/tab-toggle";
import { Muted } from "@/modules/ui/components/typography";
import { cn } from "@/modules/ui/lib/utils";

/**
 * The edit of a team's dashboard limit: all dashboards, or the ones picked. Kept as a choice of its own
 * because the stored limit is only its dashboard ids, empty meaning "all": "Specific" with nothing picked
 * cannot be saved, and the modal refuses it rather than saving "all" (`isDashboardLimitDraftValid`).
 */
export type TDashboardLimitDraft = { mode: "all" | "specific"; dashboardIds: string[] };

/** Whether a draft can be saved: "Specific dashboards" needs at least one picked. */
export const isDashboardLimitDraftValid = (draft: TDashboardLimitDraft): boolean =>
  draft.mode === "all" || draft.dashboardIds.length > 0;

/** The ids a draft saves: none for "All dashboards". */
export const dashboardLimitDraftIds = (draft: TDashboardLimitDraft): string[] =>
  draft.mode === "all" ? [] : draft.dashboardIds;

interface DashboardViewerRoleSettingsProps {
  /** Owners and Managers, decided on the server. */
  canEdit: boolean;
  /** The workspaces the form grants the team now: dashboards outside them are not offered. */
  selectedWorkspaceIds: string[];
  /** The saved limits and the dashboards they can name; `undefined` while they load. */
  limits: TTeamDashboardLimitsResource | undefined;
  /** The edit in progress; `null` while it matches the saved limits. */
  value: TDashboardLimitDraft | null;
  onChange: (draft: TDashboardLimitDraft) => void;
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
 * the team's Dashboard Viewer members open in its workspaces: "All dashboards", or "Specific dashboards"
 * picked from a list.
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
  const toggleId = useId();

  const options = useMemo(
    () =>
      (limits?.dashboards ?? [])
        .filter(({ workspaceId }) => selectedWorkspaceIds.includes(workspaceId))
        .map(({ id, name, workspaceName }) => ({ value: id, label: `${name} · ${workspaceName}` })),
    [limits?.dashboards, selectedWorkspaceIds]
  );
  const saved: TDashboardLimitDraft = {
    mode: limits?.limited ? "specific" : "all",
    dashboardIds: limits?.dashboardIds ?? [],
  };
  const draft = value ?? saved;
  const selected = draft.dashboardIds.filter((id) => options.some((option) => option.value === id));
  const disabled = !canEdit || !limits;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="rounded-md border border-slate-200">
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 data-[state=open]:rounded-b-none">
          {t("workspace.settings.teams.dashboard_viewer_role_settings")}
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content className="flex flex-col gap-2 border-t border-slate-200 px-3 py-3">
        <Label id={`${toggleId}-toggle-label`}>{t("workspace.settings.teams.dashboard_access")}</Label>
        <TabToggle
          id={toggleId}
          value={draft.mode}
          disabled={disabled}
          options={[
            { value: "all", label: t("workspace.settings.teams.all_dashboards") },
            { value: "specific", label: t("workspace.settings.teams.specific_dashboards") },
          ]}
          onChange={(mode) => onChange({ ...draft, mode })}
        />
        {draft.mode === "specific" && (
          <>
            <MultiSelect
              options={options}
              value={selected}
              onChange={(dashboardIds) => onChange({ mode: "specific", dashboardIds })}
              placeholder={t("workspace.settings.teams.select_dashboards")}
              ariaLabelledBy={`${toggleId}-toggle-label`}
              disabled={disabled}
              readOnly={disabled}
              // No workspace picked above means no dashboard to offer: say so instead of a list that never opens.
              emptyMessage={
                options.length === 0
                  ? t("workspace.settings.teams.dashboard_access_no_workspace")
                  : t("workspace.settings.teams.dashboard_access_no_match")
              }
            />
            {value !== null && selected.length === 0 && (
              <Muted className="block text-amber-700">
                {t("workspace.settings.teams.dashboard_access_pick_one")}
              </Muted>
            )}
          </>
        )}
        {value === null && limits?.limited && selected.length === 0 && (
          <Muted className="block text-amber-700">
            {t("workspace.settings.teams.dashboard_access_limited_to_none")}
          </Muted>
        )}
        <Muted className="block text-slate-500">
          {t("workspace.settings.teams.dashboard_access_helper")}
        </Muted>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
