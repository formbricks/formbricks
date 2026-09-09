"use client";

import type { TFunction } from "i18next";
import { HelpCircleIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { TUser, TUserNotificationSettings } from "@formbricks/types/user";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";
import { EmptyState } from "@/modules/ui/components/empty-state";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { type TAlertRow, getAlertRows } from "../lib/alert-rows";
import { Membership } from "../types";
import { NotificationSwitch } from "./NotificationSwitch";

interface EditAlertsProps {
  memberships: Membership[];
  user: TUser;
  autoDisableNotificationType: string;
  autoDisableNotificationElementId: string;
}

/**
 * Defined at module level rather than inside the component: an inline `cell` that returns JSX reads as a
 * nested component definition to Sonar (typescript:S6478). One array serves every organization's table.
 */
const getAlertColumns = ({
  t,
  notificationSettings,
  autoDisableNotificationType,
  autoDisableNotificationElementId,
}: Readonly<{
  t: TFunction;
  notificationSettings: TUserNotificationSettings;
  autoDisableNotificationType: string;
  autoDisableNotificationElementId: string;
}>): TSettingsTableColumn<TAlertRow>[] => [
  {
    id: "survey",
    header: t("common.survey"),
    headerClassName: "w-[45%]",
    cellClassName: "font-medium text-slate-900",
    skeletonWidth: "w-48",
    cell: (row) => row.surveyName,
  },
  {
    // A column of its own rather than a sub-line under the survey name: the surveys of an organization
    // are listed together here, so the same name can appear once per workspace, and an unlabelled second
    // line left the reader to guess what it named.
    id: "workspace",
    header: t("common.workspace"),
    headerClassName: "w-[30%]",
    cellClassName: "text-slate-500",
    skeletonWidth: "w-32",
    cell: (row) => row.workspaceName,
  },
  {
    id: "alert",
    // `inline-flex`, not `flex`: the column is centred with `align`, which only moves inline-level
    // content. A block-level trigger would ignore it.
    header: (
      <TooltipProvider delayDuration={50}>
        <Tooltip>
          <TooltipTrigger className="inline-flex cursor-default items-center gap-x-2">
            <span>{t("workspace.settings.notifications.every_response")}</span>
            <HelpCircleIcon className="size-4 shrink-0 text-slate-500" />
          </TooltipTrigger>
          <TooltipContent>{t("workspace.settings.notifications.every_response_tooltip")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    headerClassName: "w-[25%]",
    align: "center",
    skeletonWidth: "w-10",
    cell: (row) => (
      <div className="flex justify-center">
        <NotificationSwitch
          surveyOrWorkspaceOrOrganizationId={row.surveyId}
          notificationSettings={notificationSettings}
          notificationType={"alert"}
          autoDisableNotificationType={autoDisableNotificationType}
          autoDisableNotificationElementId={autoDisableNotificationElementId}
        />
      </div>
    ),
  },
];

export const EditAlerts = ({
  memberships,
  user,
  autoDisableNotificationType,
  autoDisableNotificationElementId,
}: Readonly<EditAlertsProps>) => {
  const { t } = useTranslation();

  if (memberships.length === 0) {
    return <EmptyState text={t("common.no_surveys_found")} variant="simple" />;
  }

  const columns = getAlertColumns({
    t,
    notificationSettings: user.notificationSettings!,
    autoDisableNotificationType,
    autoDisableNotificationElementId,
  });

  return (
    <>
      {memberships.map((membership) => {
        // One row list per organization: the surveys are nested one level deeper, under workspaces, and
        // each row names the workspace it came from.
        const rows: TAlertRow[] = getAlertRows(membership.organization.workspaces);

        return (
          <div key={membership.organization.id}>
            <div className="mb-5 grid grid-cols-6 items-center gap-x-3">
              <div className="col-span-3 flex items-center gap-x-3">
                <UsersIcon className="h-6 w-7 text-slate-600" />
                <p className="text-sm font-medium text-slate-800">{membership.organization.name}</p>
              </div>

              <div className="col-span-3 flex items-center justify-end pr-2">
                <p className="pr-4 text-sm text-slate-600">
                  {t("workspace.settings.notifications.auto_subscribe_to_new_surveys")}
                </p>
                <NotificationSwitch
                  surveyOrWorkspaceOrOrganizationId={membership.organization.id}
                  notificationSettings={user.notificationSettings!}
                  notificationType={"unsubscribedOrganizationIds"}
                  autoDisableNotificationType={autoDisableNotificationType}
                  autoDisableNotificationElementId={autoDisableNotificationElementId}
                />
              </div>
            </div>

            {/*
              `frame="card"` rather than a flush card body: this page stacks one table per organization
              inside a single settings card, each with its own header block above it, so the tables carry
              their own frames and the card keeps its padding.
            */}
            <SettingsTable
              columns={columns}
              rows={rows}
              getRowId={(row) => row.surveyId}
              emptyMessage={t("common.no_surveys_found")}
              frame="card"
              containerClassName="mb-6"
              aria-label={membership.organization.name}
              footer={
                <p className="pb-3 pl-4 text-xs text-slate-400">
                  {t("workspace.settings.notifications.want_to_loop_in_organization_mates")}{" "}
                  <Link
                    className="font-semibold"
                    href={organizationSettingsPath(membership.organization.id, "teams")}>
                    {t("common.invite_them")}
                  </Link>
                </p>
              }
            />
          </div>
        );
      })}
    </>
  );
};
