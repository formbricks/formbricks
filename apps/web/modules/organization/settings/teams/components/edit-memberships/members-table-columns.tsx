"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { TOrganizationRole } from "@formbricks/types/memberships";
import { formatDateForDisplay, formatDateWithOrdinal } from "@/lib/utils/datetime";
import type { TMemberTableRow } from "@/modules/organization/settings/teams/lib/member-table";
import { Badge } from "@/modules/ui/components/badge";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { MemberRowMenu } from "./member-row-menu";
import { ReactivateMemberButton } from "./reactivate-member-button";

export type TMemberRowPermissions = {
  isSelf: boolean;
  canDelete: boolean;
  canEditRole: boolean;
  canEditAttributes: boolean;
  canManageInvite: boolean;
  canOpenSettings: boolean;
};

const STATUS_BADGE: Record<TMemberTableRow["status"], "success" | "gray" | "warning"> = {
  active: "success",
  inactive: "gray",
  invited: "warning",
  expired: "gray",
};

const getStatusLabel = (status: TMemberTableRow["status"], t: TFunction): string =>
  ({
    active: t("common.active"),
    inactive: t("common.inactive"),
    invited: t("workspace.settings.members.invited"),
    expired: t("common.expired"),
  })[status];

const LAST_SIGN_IN_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };

type TColumnContext = {
  t: TFunction;
  locale: string;
  organizationId: string;
  roleLabels: Record<TOrganizationRole, string>;
  attributeKeys: readonly { key: string; label: string }[];
  showLastSignIn: boolean;
  reportingTimeZone: string;
  /** Whether the caller may reactivate this inactive member (ENG-3610). */
  canReactivate: (row: TMemberTableRow) => boolean;
  permissionsFor: (row: TMemberTableRow) => TMemberRowPermissions;
  onOpenSettings: (row: TMemberTableRow) => void;
};

const renderStatus = (member: TMemberTableRow, context: TColumnContext) => {
  const { t, locale } = context;
  const badge = (
    <Badge type={STATUS_BADGE[member.status]} size="tiny" text={getStatusLabel(member.status, t)} />
  );
  const showExpiry = member.invite && member.status === "invited";
  return (
    <div className="flex items-center gap-2">
      {showExpiry && member.invite ? (
        <TooltipRenderer
          tooltipContent={t("workspace.settings.general.invite_expires_on", {
            date: formatDateWithOrdinal(member.invite.expiresAt, locale),
          })}>
          {badge}
        </TooltipRenderer>
      ) : (
        badge
      )}
      {member.member && context.canReactivate(member) ? (
        <ReactivateMemberButton
          organizationId={context.organizationId}
          userId={member.member.userId}
          name={member.name || member.email}
        />
      ) : null}
    </div>
  );
};

const renderLastSignIn = (row: TMemberTableRow, { t, locale, reportingTimeZone }: TColumnContext) => {
  if (!row.member) return null;
  if (!row.member.lastLoginAt) {
    return <span className="text-slate-500">{t("common.no_sign_in_recorded")}</span>;
  }
  return (
    <span className="ph-no-capture text-slate-600">
      {formatDateForDisplay(new Date(row.member.lastLoginAt), locale, {
        ...LAST_SIGN_IN_OPTIONS,
        timeZone: reportingTimeZone,
      })}
    </span>
  );
};

const renderValues = (values: readonly string[]) =>
  values.length > 0 ? (
    <span className="ph-no-capture truncate text-slate-600">{values.join(", ")}</span>
  ) : (
    <span className="text-slate-400">—</span>
  );

/**
 * The Members table's columns (ENG-7474), at module level so no cell is a component defined during render:
 * Full name, Email, Role, Teams, one per Member attribute key, Last sign-in (Owners and Managers), Status
 * and the row menu.
 */
export const getMemberTableColumns = (context: TColumnContext): ColumnDef<TMemberTableRow>[] => {
  const { t } = context;
  return [
    {
      id: "name",
      header: t("common.full_name"),
      size: 180,
      cell: ({ row }) => (
        <span className="ph-no-capture truncate font-medium text-slate-900">{row.original.name}</span>
      ),
    },
    {
      id: "email",
      header: t("common.email"),
      size: 220,
      cell: ({ row }) => <span className="ph-no-capture truncate text-slate-600">{row.original.email}</span>,
    },
    {
      id: "role",
      header: t("common.role"),
      size: 140,
      cell: ({ row }) => (
        <span className="ph-no-capture text-slate-600">{context.roleLabels[row.original.role]}</span>
      ),
    },
    {
      id: "teams",
      header: t("common.teams"),
      size: 180,
      cell: ({ row }) => renderValues(row.original.teams.map((team) => team.name)),
    },
    ...context.attributeKeys.map(
      (key): ColumnDef<TMemberTableRow> => ({
        id: `attribute:${key.key}`,
        header: key.label,
        size: 160,
        cell: ({ row }) => renderValues(row.original.attributes[key.key] ?? []),
      })
    ),
    ...(context.showLastSignIn
      ? [
          {
            id: "lastSignIn",
            header: t("common.last_sign_in"),
            size: 140,
            cell: ({ row }) => renderLastSignIn(row.original, context),
          } satisfies ColumnDef<TMemberTableRow>,
        ]
      : []),
    {
      id: "status",
      header: t("common.status"),
      size: 150,
      cell: ({ row }) => renderStatus(row.original, context),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">{t("common.actions")}</span>,
      size: 56,
      cell: ({ row }) => {
        const permissions = context.permissionsFor(row.original);
        return (
          <div className="flex w-full justify-end">
            <MemberRowMenu
              organizationId={context.organizationId}
              row={row.original}
              canOpenSettings={permissions.canOpenSettings}
              canManageInvite={permissions.canManageInvite}
              canDelete={permissions.canDelete}
              onOpenSettings={() => context.onOpenSettings(row.original)}
            />
          </div>
        );
      },
    },
  ];
};
