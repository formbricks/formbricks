"use client";

import { useQuery } from "@tanstack/react-query";
import { EyeIcon, InfoIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type TDashboardAccessOverview,
  VIEW_AS_PARAM,
  getDashboardAccessOverview,
} from "@/modules/ee/analysis/lib/api-client";
import { Button } from "@/modules/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

/** The member a dashboard is being viewed as, as the banner names them. */
export type TViewAsMember = {
  userId: string;
  name: string;
  role: string;
  attributes: { label: string; values: string[] }[];
};

const ROLE_ORDER = ["owner", "manager", "member", "dashboard_viewer", "billing"];

const useRoleLabel = () => {
  const { t } = useTranslation();
  return (role: string): string => {
    switch (role) {
      case "owner":
        return t("workspace.settings.teams.owner");
      case "manager":
        return t("workspace.settings.teams.manager");
      case "member":
        return t("workspace.settings.teams.member");
      case "dashboard_viewer":
        return t("workspace.settings.teams.dashboard_viewer");
      case "billing":
        return t("workspace.settings.teams.billing");
      default:
        return role;
    }
  };
};

const formatAttributes = (attributes: TViewAsMember["attributes"]): string =>
  attributes.map(({ label, values }) => `${label}: ${values.join(", ")}`).join(" · ");

/** The URL of this dashboard page viewed as `userId`, or as oneself again (`null`), with no filters. */
const viewAsUrl = (userId: string | null): string => {
  const url = new URL(window.location.href);
  url.search = "";
  if (userId) url.searchParams.set(VIEW_AS_PARAM, userId);
  return url.toString();
};

/** Starting or stopping View as reloads the page: no read cached for one person answers for another. */
const goViewAs = (userId: string | null) => {
  window.location.assign(viewAsUrl(userId));
};

const useAccessOverview = (dashboardId: string, enabled: boolean) =>
  useQuery<TDashboardAccessOverview>({
    queryKey: ["dashboards", "access", dashboardId],
    queryFn: ({ signal }) => getDashboardAccessOverview(dashboardId, signal),
    enabled,
  });

/** "View as": a searchable list of the organization's members, by role, to see the dashboard as one. */
export const ViewAsButton = ({ dashboardId }: Readonly<{ dashboardId: string }>) => {
  const { t } = useTranslation();
  const roleLabel = useRoleLabel();
  const [open, setOpen] = useState(false);
  const overview = useAccessOverview(dashboardId, open);

  const groups = useMemo(() => {
    const byRole = new Map<string, TDashboardAccessOverview["members"]>();
    for (const member of overview.data?.members ?? []) {
      byRole.set(member.role, [...(byRole.get(member.role) ?? []), member]);
    }
    return [...byRole.entries()].sort(([a], [b]) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
  }, [overview.data?.members]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <EyeIcon className="size-4" />
          {t("workspace.analysis.dashboards.view_as")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command>
          <CommandInput placeholder={t("workspace.analysis.dashboards.view_as_search")} />
          <CommandList>
            <CommandEmpty>
              {overview.isPending
                ? t("common.loading")
                : t("workspace.analysis.dashboards.view_as_no_members")}
            </CommandEmpty>
            {groups.map(([role, members]) => (
              <CommandGroup key={role} heading={roleLabel(role)}>
                {members.map((member) => (
                  <CommandItem
                    key={member.userId}
                    value={`${member.name} ${member.email} ${member.userId}`}
                    onSelect={() => goViewAs(member.userId)}>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-900">{member.name || member.email}</p>
                      {member.attributes.length > 0 && (
                        <p className="truncate text-xs text-slate-500">
                          {formatAttributes(member.attributes)}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/** The banner while viewing as someone: who, their role and attributes, and the way back. */
export const ViewAsBanner = ({ member }: Readonly<{ member: TViewAsMember }>) => {
  const { t } = useTranslation();
  const roleLabel = useRoleLabel();
  const parts = [member.name, roleLabel(member.role), formatAttributes(member.attributes)].filter(Boolean);
  return (
    <output className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span className="min-w-0 truncate">
        {t("workspace.analysis.dashboards.viewing_as", { member: parts.join(" · ") })}
      </span>
      <Button size="sm" variant="secondary" onClick={() => goViewAs(null)}>
        {t("workspace.analysis.dashboards.stop_viewing_as")}
      </Button>
    </output>
  );
};

const usePermissionLabel = () => {
  const { t } = useTranslation();
  return (permission: TDashboardAccessOverview["teams"][number]["permission"]): string => {
    switch (permission) {
      case "read":
        return t("workspace.settings.teams.read");
      case "readWrite":
        return t("workspace.settings.teams.read_write");
      case "manage":
        return t("workspace.settings.teams.manage");
    }
  };
};

/** "Access": who opens this dashboard, read-only; access is changed in Team settings. */
export const AccessButton = ({ dashboardId }: Readonly<{ dashboardId: string }>) => {
  const { t } = useTranslation();
  const permissionLabel = usePermissionLabel();
  const [open, setOpen] = useState(false);
  const overview = useAccessOverview(dashboardId, open);
  const teams = overview.data?.teams ?? [];

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <UsersIcon className="size-4" />
        {t("workspace.analysis.dashboards.access")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("workspace.analysis.dashboards.access")}</DialogTitle>
            <DialogDescription>{t("workspace.analysis.dashboards.access_description")}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 font-medium">{t("common.team")}</th>
                  <th className="py-2 font-medium">
                    <span className="inline-flex items-center gap-1">
                      {t("workspace.analysis.dashboards.access_workspace_permission")}
                      <TooltipRenderer tooltipContent={t("workspace.analysis.dashboards.access_tooltip")}>
                        <InfoIcon
                          className="size-3.5"
                          aria-label={t("workspace.analysis.dashboards.access_tooltip")}
                        />
                      </TooltipRenderer>
                    </span>
                  </th>
                  <th className="py-2 font-medium">{t("workspace.analysis.dashboards.access_dashboards")}</th>
                  <th className="py-2 font-medium">{t("common.members")}</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id} className="border-t border-slate-100">
                    <td className="py-2 text-slate-900">{team.name}</td>
                    <td className="py-2 text-slate-700">{permissionLabel(team.permission)}</td>
                    <td className="py-2 text-slate-700">
                      {team.limitedDashboardCount === null
                        ? t("workspace.settings.teams.all_dashboards")
                        : t("workspace.analysis.dashboards.access_selected_dashboards", {
                            count: team.limitedDashboardCount,
                          })}
                    </td>
                    <td className="py-2 text-slate-700">{team.memberCount}</td>
                  </tr>
                ))}
                {!overview.isPending && teams.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      {t("workspace.analysis.dashboards.access_no_teams")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DialogBody>
          <DialogFooter>
            {overview.data && (
              <Button variant="secondary" asChild>
                <Link href={`/organizations/${overview.data.organizationId}/settings/teams`}>
                  {t("workspace.analysis.dashboards.manage_access")}
                </Link>
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>{t("common.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
