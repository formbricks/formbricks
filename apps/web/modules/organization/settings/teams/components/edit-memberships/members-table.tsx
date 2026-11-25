"use client";

import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { DownloadIcon } from "lucide-react";
import { type ReactNode, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { TMember, TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags, getOrganizationRoleLabels } from "@/lib/membership/utils";
import { getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { MemberSettingsDialog } from "@/modules/ee/member-attributes/components/member-settings-dialog";
import {
  useMemberAttributeKeys,
  useMemberAttributeRows,
} from "@/modules/ee/member-attributes/hooks/use-member-attributes";
import { isRoleEditDisabled } from "@/modules/ee/role-management/lib/role-edit-rules";
import { canActOnInvite, showDeleteButton } from "@/modules/organization/settings/teams/lib/member-controls";
import { buildMemberCsvExport } from "@/modules/organization/settings/teams/lib/member-csv-import";
import {
  type TMemberTableRow,
  type TMemberTeam,
  buildMemberTableRows,
  matchesMemberSearch,
} from "@/modules/organization/settings/teams/lib/member-table";
import {
  type TLastSignInSort,
  sortMembersByLastSignIn,
} from "@/modules/organization/settings/teams/lib/sort-members";
import { hasMoreThanOneActiveOwner } from "@/modules/organization/settings/teams/lib/utils";
import type { TInvite } from "@/modules/organization/settings/teams/types/invites";
import { Button } from "@/modules/ui/components/button";
import { ListTable, TableToolbar } from "@/modules/ui/components/table-toolbar";
import { useTableColumnState } from "@/modules/ui/components/table-toolbar/hooks/use-table-column-state";
import { buildColumnSettings } from "@/modules/ui/components/table-toolbar/lib/column-settings";
import { type TMemberRowPermissions, getMemberTableColumns } from "./members-table-columns";

type TMembersTableProps = Readonly<{
  organizationId: string;
  members: TMember[];
  invites: TInvite[];
  teamsByUserId: Record<string, TMemberTeam[]>;
  teamsByInviteId: Record<string, TMemberTeam[]>;
  currentUserId: string;
  currentUserRole: TOrganizationRole;
  isAccessControlAllowed: boolean;
  isFormbricksCloud: boolean;
  isDashboardViewerRoleEnabled: boolean;
  isUserManagementDisabledFromUi: boolean;
  /** `organization.manage_access` (ENG-6812): the controls that change who is a member follow it. */
  canManageUsers: boolean;
  /**
   * Member attributes are on for this organization (Access Control + Dashboards) and the viewer may read
   * everyone's (an Owner or Manager): the attribute columns and editing.
   */
  canManageMemberAttributes: boolean;
  /** The viewer's own attributes, read on the server, for their read-only Member settings. */
  ownAttributes: { key: string; label: string; values: string[] }[];
  /** The organization's reporting time zone, for the Last sign-in day. */
  reportingTimeZone: string;
  /** Page actions on the right of the toolbar: Invite member, Leave organization. */
  actions?: ReactNode;
}>;

/**
 * The Members section on the shared table toolbar (ENG-7474): search, hideable columns (one per Member
 * attribute key), status, and a row menu. Members and invites are read on the server as before; Member
 * attributes come from the v3 endpoints through TanStack Query.
 */
/** Saves the member list as a CSV the Invite member import takes back (Owners and Managers only). */
const downloadMemberList = (csv: string) => {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const subscribeNoop = () => () => {};

export const MembersTable = ({
  organizationId,
  members,
  invites,
  teamsByUserId,
  teamsByInviteId,
  currentUserId,
  currentUserRole,
  isAccessControlAllowed,
  isFormbricksCloud,
  isDashboardViewerRoleEnabled,
  isUserManagementDisabledFromUi,
  canManageUsers,
  canManageMemberAttributes,
  ownAttributes,
  reportingTimeZone,
  actions,
}: TMembersTableProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const roleLabels = getOrganizationRoleLabels(t);
  const [search, setSearch] = useState("");
  // As listed, or by last sign-in (ENG-3317); invites have none and follow the members.
  const [sortBy, setSortBy] = useState<"default" | TLastSignInSort>("default");
  const [settingsRowId, setSettingsRowId] = useState<string | null>(null);
  const { isManager, isOwner } = getAccessFlags(currentUserRole);

  const keysQuery = useMemberAttributeKeys({ organizationId, enabled: canManageMemberAttributes });
  const valuesQuery = useMemberAttributeRows({ organizationId, enabled: canManageMemberAttributes });
  // The server renders no attribute columns (their query runs in the browser), so the first client render
  // must not either, even when the page's query cache already holds them, or React rebuilds the table.
  const isHydrated = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  const attributeKeys = useMemo(
    () => (isHydrated ? (keysQuery.data ?? []) : []),
    [isHydrated, keysQuery.data]
  );

  const allRows = useMemo(
    () =>
      buildMemberTableRows({
        members: sortBy === "default" ? members : sortMembersByLastSignIn(members, sortBy),
        invites,
        teamsByUserId,
        teamsByInviteId,
        attributeRows: valuesQuery.data ?? [],
      }),
    [members, invites, teamsByUserId, teamsByInviteId, valuesQuery.data, sortBy]
  );
  const rows = useMemo(() => allRows.filter((row) => matchesMemberSearch(row, search)), [allRows, search]);
  const doesOrgHaveMoreThanOneOwner = hasMoreThanOneActiveOwner(members);

  const attributeColumnIds = attributeKeys.map((key) => `attribute:${key.key}`);
  // Last sign-in is for Owners and Managers only (ENG-3317); the server strips it for everyone else.
  const showLastSignIn = isOwner || isManager;
  const columnIds = [
    "name",
    "email",
    "role",
    "teams",
    ...attributeColumnIds,
    ...(showLastSignIn ? ["lastSignIn"] : []),
    "status",
    "actions",
  ];
  const columnState = useTableColumnState({ storagePrefix: `${organizationId}-members`, columnIds });

  const permissionsFor = (row: TMemberTableRow): TMemberRowPermissions => {
    const isSelf = row.kind === "member" && row.member?.userId === currentUserId;
    const target = (row.member ?? row.invite) as TMember | TInvite;
    const canDelete = showDeleteButton(target, {
      canManageUsers,
      isManager,
      currentUserId,
      doesOrgHaveMoreThanOneOwner,
    });
    const canEditRole =
      isAccessControlAllowed &&
      (isOwner || isManager) &&
      !isRoleEditDisabled({
        isUserManagementDisabledFromUi: isUserManagementDisabledFromUi || !canManageUsers,
        currentUserRole,
        memberRole: row.role,
        memberId: row.kind === "member" ? row.member?.userId : "",
        userId: currentUserId,
        memberAccepted: row.kind === "member" ? row.member?.accepted : undefined,
        doesOrgHaveMoreThanOneOwner,
      });
    const canEditAttributes =
      canManageMemberAttributes && canManageUsers && !(isManager && row.role === "owner");
    return {
      isSelf,
      canDelete,
      canEditRole,
      canEditAttributes,
      canManageInvite: row.kind === "invite" && canActOnInvite(target, { canManageUsers, isManager }),
      canOpenSettings: canManageMemberAttributes || isOwner || isManager || isSelf,
    };
  };

  // Rebuilt each render: the cells read this render's permissions, and the table's state lives outside it.
  const columns = getMemberTableColumns({
    t,
    locale,
    organizationId,
    roleLabels,
    attributeKeys,
    showLastSignIn,
    reportingTimeZone,
    canReactivate: (row) =>
      row.status === "inactive" && canManageUsers && !(isManager && row.role === "owner"),
    permissionsFor,
    onOpenSettings: (row) => setSettingsRowId(row.id),
  });

  // The row menu stays the last column: a saved order from before an attribute key existed would
  // otherwise leave the new attribute column after it.
  const actionsLastOrder = [...columnState.columnOrder.filter((id) => id !== "actions"), "actions"];

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnOrder: actionsLastOrder,
      columnVisibility: columnState.columnVisibility,
      columnSizing: columnState.columnSizing,
    },
    ...columnState.sizingOptions,
  });

  const columnLabels = [
    { id: "name", label: t("common.full_name") },
    { id: "email", label: t("common.email") },
    { id: "role", label: t("common.role") },
    { id: "teams", label: t("common.teams") },
    ...attributeKeys.map((key) => ({ id: `attribute:${key.key}`, label: key.label })),
    ...(showLastSignIn ? [{ id: "lastSignIn", label: t("common.last_sign_in") }] : []),
    { id: "status", label: t("common.status") },
  ];

  const settingsRow = settingsRowId ? allRows.find((row) => row.id === settingsRowId) : undefined;
  const settingsPermissions = settingsRow ? permissionsFor(settingsRow) : null;
  // A member who may not read everyone's attributes sees only their own, read-only.
  let settingsAttributeKeys: { key: string; label: string }[] = [];
  if (canManageMemberAttributes) {
    settingsAttributeKeys = attributeKeys.map(({ key, label }) => ({ key, label }));
  } else if (settingsPermissions?.isSelf) {
    settingsAttributeKeys = ownAttributes.map(({ key, label }) => ({ key, label }));
  }
  const settingsRowWithOwnValues =
    settingsRow && !canManageMemberAttributes && settingsPermissions?.isSelf
      ? {
          ...settingsRow,
          attributes: Object.fromEntries(ownAttributes.map(({ key, values }) => [key, values])),
        }
      : settingsRow;

  return (
    <div className="space-y-3 px-4 pt-4">
      <TableToolbar
        settings={{
          ...(showLastSignIn && {
            sort: {
              options: [
                { value: "default", label: t("workspace.settings.members.sort_default") },
                { value: "desc", label: t("workspace.settings.members.sort_last_sign_in_newest") },
                { value: "asc", label: t("workspace.settings.members.sort_last_sign_in_oldest") },
              ],
              value: sortBy,
              onChange: (value) => setSortBy(value as typeof sortBy),
            },
          }),
          columns: {
            items: buildColumnSettings(columnLabels, columnState.columnOrder, columnState.columnVisibility, [
              "name",
            ]),
            onVisibilityChange: (id, visible) =>
              columnState.setColumnVisibility((current) => ({ ...current, [id]: visible })),
            onMove: columnState.moveColumn,
          },
        }}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("workspace.settings.members.search_members"),
        }}
        actions={
          canManageMemberAttributes ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                // Only a complete snapshot: while the values load, or when they failed, every member would
                // export blank cells, and re-importing the file would clear their values.
                disabled={!keysQuery.isSuccess || !valuesQuery.isSuccess}
                onClick={() =>
                  downloadMemberList(
                    buildMemberCsvExport(
                      allRows,
                      attributeKeys.map(({ key, label }) => ({ key, label }))
                    )
                  )
                }>
                <DownloadIcon aria-hidden="true" />
                {t("workspace.settings.members.download_member_list")}
              </Button>
              {actions}
            </div>
          ) : (
            actions
          )
        }
      />
      {canManageMemberAttributes && (keysQuery.isError || valuesQuery.isError) && (
        <p className="text-sm text-red-700" role="alert">
          {getV3ApiErrorMessage(
            keysQuery.error ?? valuesQuery.error,
            t("workspace.settings.members.attributes_load_failed")
          )}
        </p>
      )}
      <div className="-mx-4">
        <ListTable
          variant="embedded"
          table={table}
          testId="members-table"
          isLoading={false}
          hasFilters={search.trim() !== ""}
          onClearFilters={() => setSearch("")}
          isRowClickable={(row) => permissionsFor(row.original).canOpenSettings}
          onRowClick={(row) => setSettingsRowId(row.original.id)}
        />
      </div>
      {settingsRowWithOwnValues && settingsPermissions && (
        <MemberSettingsDialog
          key={settingsRowWithOwnValues.id}
          organizationId={organizationId}
          row={settingsRowWithOwnValues}
          allRows={allRows}
          open
          setOpen={(open) => {
            if (!open) setSettingsRowId(null);
          }}
          currentUserRole={currentUserRole}
          isFormbricksCloud={isFormbricksCloud}
          isDashboardViewerRoleEnabled={isDashboardViewerRoleEnabled}
          canEditRole={settingsPermissions.canEditRole}
          canEditAttributes={settingsPermissions.canEditAttributes}
          canDelete={settingsPermissions.canDelete}
          attributeKeys={settingsAttributeKeys}
        />
      )}
    </div>
  );
};
