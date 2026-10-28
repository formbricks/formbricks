import type { TOrganizationRole } from "@formbricks/types/memberships";
import { getOrganizationRoleLabels } from "@/lib/membership/utils";
import { formatDateForDisplay } from "@/lib/utils/datetime";
import { getTranslate } from "@/lingodotdev/server";
import { Badge } from "@/modules/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { type TMemberRow, type TMemberRowAccess } from "../lib/member-rows";
import { MemberManageDialog } from "./member-manage-dialog";
import { TABLE_HEAD_CLASS, TableFrame } from "./section-heading";

interface MembersTableProps {
  organizationId: string;
  currentUserId: string;
  locale: string;
  timeZone: string;
  /** Whether teams exist at all (licensed); the column is hidden otherwise. */
  showTeams: boolean;
  /** Two-factor state is only loaded for owners and managers; the column is hidden otherwise. */
  showTwoFactor: boolean;
  rows: { row: TMemberRow; access: TMemberRowAccess }[];
}

const HIDE_BELOW_MD = "hidden md:table-cell";

const ALL_TEAMS_ROLES: ReadonlySet<TOrganizationRole> = new Set(["owner", "manager"]);

export const MembersTable = async ({
  organizationId,
  currentUserId,
  locale,
  timeZone,
  showTeams,
  showTwoFactor,
  rows,
}: Readonly<MembersTableProps>) => {
  const t = await getTranslate();
  const roleLabels = getOrganizationRoleLabels(t);

  const renderTeams = (row: TMemberRow) => {
    if (row.role === "billing") return "—";
    if (row.kind === "member" && ALL_TEAMS_ROLES.has(row.role))
      return t("shell.organization.members.all_teams");
    return row.teamNames.length > 0 ? row.teamNames.join(", ") : "—";
  };

  const getSecondaryLine = (row: TMemberRow) => {
    if (row.kind !== "invite" || !row.invitedAt) return row.email;
    const invited = t("shell.organization.members.invited_on", {
      date: formatDateForDisplay(row.invitedAt, locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone,
      }),
    });
    return row.name ? `${row.email} · ${invited}` : invited;
  };

  const renderTwoFactor = (row: TMemberRow) => {
    if (row.twoFactorEnabled === null) return t("shell.organization.members.two_factor_not_set_up");
    return row.twoFactorEnabled ? (
      <Badge type="success" size="normal" text={t("shell.organization.members.two_factor_on")} />
    ) : (
      <Badge type="warning" size="normal" text={t("shell.organization.members.two_factor_off")} />
    );
  };

  return (
    <TableFrame>
      <Table aria-label={t("common.members")}>
        <TableHeader>
          <TableRow>
            <TableHead className={TABLE_HEAD_CLASS}>{t("shell.organization.members.member")}</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>{t("common.role")}</TableHead>
            {showTeams && (
              <TableHead className={`${TABLE_HEAD_CLASS} ${HIDE_BELOW_MD}`}>{t("common.teams")}</TableHead>
            )}
            {showTwoFactor && (
              <TableHead className={`${TABLE_HEAD_CLASS} ${HIDE_BELOW_MD}`}>
                {t("shell.organization.members.two_factor")}
              </TableHead>
            )}
            <TableHead>
              <span className="sr-only">{t("common.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ row, access }) => {
            const isSelf = row.kind === "member" && row.id === currentUserId;
            const hasActions =
              access.assignableRoles.length > 0 ||
              access.canRemove ||
              access.canReactivate ||
              access.canResend ||
              access.canShareLink ||
              access.canLeave;

            return (
              <TableRow key={`${row.kind}-${row.id}`}>
                <TableCell className="max-w-64">
                  <div className="flex flex-col gap-0.5">
                    <span className="ph-no-capture truncate font-medium text-slate-800">
                      {row.name || row.email}
                      {isSelf && ` ${t("shell.organization.members.you_suffix")}`}
                    </span>
                    <span className="ph-no-capture truncate text-xs text-slate-500">
                      {getSecondaryLine(row)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge type="gray" size="normal" text={roleLabels[row.role]} />
                    {row.status === "pending" && (
                      <Badge type="warning" size="normal" text={t("common.pending")} />
                    )}
                    {row.status === "expired" && (
                      <Badge type="gray" size="normal" text={t("common.expired")} />
                    )}
                    {row.status === "inactive" && (
                      <Badge type="gray" size="normal" text={t("common.inactive")} />
                    )}
                  </div>
                </TableCell>
                {showTeams && (
                  <TableCell className={`${HIDE_BELOW_MD} max-w-56 truncate`}>{renderTeams(row)}</TableCell>
                )}
                {showTwoFactor && <TableCell className={HIDE_BELOW_MD}>{renderTwoFactor(row)}</TableCell>}
                <TableCell className="text-right">
                  {hasActions && (
                    <MemberManageDialog
                      organizationId={organizationId}
                      member={{
                        kind: row.kind,
                        id: row.id,
                        name: row.name,
                        email: row.email,
                        role: row.role,
                      }}
                      access={access}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableFrame>
  );
};
