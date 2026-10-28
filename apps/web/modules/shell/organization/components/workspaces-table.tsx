import { formatDateForDisplay } from "@/lib/utils/datetime";
import { getTranslate } from "@/lingodotdev/server";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import type { TWorkspaceListItem } from "../lib/workspace-directory";
import { TABLE_HEAD_CLASS, TableFrame } from "./section-heading";
import { WorkspaceRowActions } from "./workspace-row-actions";

interface WorkspacesTableProps {
  workspaces: TWorkspaceListItem[];
  canManage: boolean;
  locale: string;
  timeZone: string;
}

export const WorkspacesTable = async ({
  workspaces,
  canManage,
  locale,
  timeZone,
}: Readonly<WorkspacesTableProps>) => {
  const t = await getTranslate();

  return (
    <TableFrame>
      <Table aria-label={t("common.workspaces")}>
        <TableHeader>
          <TableRow>
            <TableHead className={TABLE_HEAD_CLASS}>{t("shell.organization.workspaces.workspace")}</TableHead>
            <TableHead className={TABLE_HEAD_CLASS}>{t("common.surveys")}</TableHead>
            <TableHead className={`${TABLE_HEAD_CLASS} hidden md:table-cell`}>
              {t("shell.organization.workspaces.created_column")}
            </TableHead>
            <TableHead>
              <span className="sr-only">{t("common.actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workspaces.map((workspace) => (
            <TableRow key={workspace.id}>
              <TableCell>
                <div className="flex flex-col items-start gap-1.5">
                  <span className="ph-no-capture font-medium text-slate-800">{workspace.name}</span>
                  <IdBadge id={workspace.id} />
                </div>
              </TableCell>
              <TableCell>{workspace.surveyCount}</TableCell>
              <TableCell className="hidden whitespace-nowrap md:table-cell">
                {formatDateForDisplay(workspace.createdAt, locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone,
                })}
              </TableCell>
              <TableCell>
                {canManage && (
                  <WorkspaceRowActions
                    workspace={{ id: workspace.id, name: workspace.name }}
                    isOnlyWorkspace={workspaces.length === 1}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
};
