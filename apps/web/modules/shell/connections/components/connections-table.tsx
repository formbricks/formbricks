import type { TFunction } from "i18next";
import { timeSinceDate } from "@/lib/time";
import { formatDateTimeForDisplay } from "@/lib/utils/datetime";
import { getTranslate } from "@/lingodotdev/server";
import { Badge } from "@/modules/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import type { TConnectionPermission, TConnectionRow, TConnectionWorkspaces } from "../lib/connection-rows";
import { type TAccessSummary, getScopeFamilyLabel } from "../lib/scope-families";
import { RevokeConnectionButton } from "./revoke-connection-button";

// A phone-width table cannot carry five columns; the workspace list is the one that grows without bound.
const MAX_NAMED_WORKSPACES = 2;

const getAccessLines = (access: TAccessSummary, t: TFunction): string[] => {
  const lines: string[] = [];
  const list = (families: TAccessSummary["write"]) =>
    families.map((family) => getScopeFamilyLabel(family, t)).join(", ");

  if (access.write.length > 0) {
    lines.push(t("shell.connections.access.write", { families: list(access.write) }));
  }
  if (access.readOnly.length > 0) {
    lines.push(t("shell.connections.access.read", { families: list(access.readOnly) }));
  }

  return lines.length > 0 ? lines : [t("shell.connections.access.none")];
};

const getPermissionLabel = (permission: TConnectionPermission, t: TFunction): string => {
  switch (permission) {
    case "read":
      return t("workspace.api_keys.permission_read");
    case "write":
      return t("workspace.api_keys.permission_write");
    case "manage":
      return t("workspace.api_keys.permission_manage");
  }
};

const getWorkspacesText = (workspaces: TConnectionWorkspaces, t: TFunction): string => {
  if (workspaces.type === "all") return t("shell.connections.workspaces.all");
  if (workspaces.type === "none") return t("shell.connections.workspaces.none");

  const shown = workspaces.items
    .slice(0, MAX_NAMED_WORKSPACES)
    .map(({ name, permission }) => `${name} (${getPermissionLabel(permission, t)})`);
  const hidden = workspaces.items.length - shown.length;

  return hidden > 0
    ? `${shown.join(", ")} ${t("shell.connections.workspaces.more", { count: hidden })}`
    : shown.join(", ");
};

const Activity = ({ row, locale, t }: Readonly<{ row: TConnectionRow; locale: string; t: TFunction }>) => {
  const date = row.kind === "oauth" ? row.authorizedAt : row.lastUsedAt;

  if (!date) {
    return <>{t("shell.connections.never_used")}</>;
  }

  const when = timeSinceDate(date, locale);
  return (
    <time dateTime={date.toISOString()} title={formatDateTimeForDisplay(date, locale)}>
      {row.kind === "oauth"
        ? t("shell.connections.authorized", { when })
        : t("shell.connections.last_used", { when })}
    </time>
  );
};

interface ConnectionsTableProps {
  rows: TConnectionRow[];
  locale: string;
}

/** Rendered on the server: only the Revoke button needs the browser. */
export const ConnectionsTable = async ({ rows, locale }: Readonly<ConnectionsTableProps>) => {
  const t = await getTranslate();

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <Table>
        <TableHeader className="bg-slate-50 text-sm text-slate-600">
          <TableRow>
            <TableHead>{t("shell.connections.columns.connection")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("shell.connections.columns.access")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("common.workspaces")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead>
              <span className="sr-only">{t("common.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const accessLines = getAccessLines(row.access, t);
            return (
              <TableRow key={`${row.kind}:${row.id}`}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium break-words text-slate-800">{row.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <Badge
                        text={
                          row.kind === "oauth"
                            ? t("shell.connections.kind_oauth")
                            : t("shell.connections.kind_api_key")
                        }
                        type={row.kind === "oauth" ? "gray" : "info"}
                        size="tiny"
                      />
                      <Activity row={row} locale={locale} t={t} />
                    </span>
                    <span className="text-xs text-slate-600 md:hidden">{accessLines.join(" · ")}</span>
                  </div>
                </TableCell>
                <TableCell className="hidden align-top md:table-cell">
                  <div className="flex flex-col gap-0.5">
                    {accessLines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{getWorkspacesText(row.workspaces, t)}</TableCell>
                <TableCell>
                  <Badge
                    text={
                      row.status === "active" ? t("common.active") : t("shell.connections.status_never_used")
                    }
                    type={row.status === "active" ? "success" : "gray"}
                    size="normal"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <RevokeConnectionButton kind={row.kind} id={row.id} name={row.name} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
