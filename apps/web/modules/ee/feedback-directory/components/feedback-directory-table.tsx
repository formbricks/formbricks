"use client";

import type { TFunction } from "i18next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  getFeedbackDirectoryDetailsAction,
  updateFeedbackDirectoryAction,
} from "@/modules/ee/feedback-directory/actions";
import { FeedbackDirectorySettingsModal } from "@/modules/ee/feedback-directory/components/feedback-directory-settings/feedback-directory-settings-modal";
import {
  TFeedbackDirectory,
  TFeedbackDirectoryDetails,
  TWorkspaceFeedbackDirectoryAccess,
  getTranslatedFeedbackDirectoryError,
} from "@/modules/ee/feedback-directory/types/feedback-directory";
import { TOrganizationWorkspace } from "@/modules/ee/teams/team-list/types/workspace";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { SettingsTable, type TSettingsTableColumn } from "@/modules/ui/components/settings-table";
import { Switch } from "@/modules/ui/components/switch";

interface FeedbackDirectoryTableProps {
  directories: TFeedbackDirectory[];
  organizationId: string;
  orgWorkspaces: TOrganizationWorkspace[];
  workspaceAccessByWorkspace: TWorkspaceFeedbackDirectoryAccess[];
  membershipRole: TOrganizationRole;
}

/**
 * Defined at module level rather than inside the component: an inline `cell` that returns JSX reads as a
 * nested component definition to Sonar (typescript:S6478), and re-declaring the array per render buys
 * nothing.
 */
const getFeedbackDirectoryColumns = ({
  t,
  isOwnerOrManager,
  loadingDirectoryId,
  viewDataWorkspaceIdByDirectory,
  onManage,
  onUnarchive,
}: Readonly<{
  t: TFunction;
  isOwnerOrManager: boolean;
  loadingDirectoryId: string | null;
  viewDataWorkspaceIdByDirectory: Map<string, string>;
  onManage: (directoryId: string) => void;
  onUnarchive: (directoryId: string) => void;
}>): TSettingsTableColumn<TFeedbackDirectory>[] => [
  {
    id: "name",
    header: t("workspace.settings.feedback_directories.directory_name"),
    headerClassName: "w-[45%]",
    cell: (directory) => directory.name,
  },
  {
    id: "workspaceCount",
    header: t("common.workspaces"),
    headerClassName: "w-[15%]",
    cell: (directory) => directory.workspaceCount,
  },
  {
    id: "status",
    header: t("common.status"),
    headerClassName: "w-[15%]",
    cell: (directory) =>
      directory.isArchived ? (
        <Badge type="gray" size="tiny" text={t("common.archived")} />
      ) : (
        <Badge type="success" size="tiny" text={t("common.active")} />
      ),
  },
  {
    id: "actions",
    header: null,
    srLabel: t("common.actions"),
    headerClassName: "w-[25%]",
    align: "right",
    cellClassName: "flex justify-end gap-2",
    stopRowClick: true,
    cell: (directory) => (
      <>
        {/* Never disabled: it is plain navigation with nothing to race. */}
        {!directory.isArchived && viewDataWorkspaceIdByDirectory.has(directory.id) && (
          <Button size="sm" variant="ghost" asChild>
            <Link
              href={`/workspaces/${viewDataWorkspaceIdByDirectory.get(directory.id)}/unify/feedback-records`}>
              {t("workspace.settings.feedback_directories.view_data")}
            </Link>
          </Button>
        )}
        {/* `disabled` on the button itself, not `pointer-events-none` on the row: the latter blocks the
            mouse but leaves the button focusable, so Enter would still start a second request. */}
        {isOwnerOrManager && !directory.isArchived && (
          <Button
            size="sm"
            variant="secondary"
            loading={loadingDirectoryId === directory.id}
            disabled={loadingDirectoryId !== null}
            onClick={() => onManage(directory.id)}>
            {t("common.manage")}
          </Button>
        )}
        {isOwnerOrManager && directory.isArchived && (
          <Button
            size="sm"
            variant="secondary"
            loading={loadingDirectoryId === directory.id}
            disabled={loadingDirectoryId !== null}
            onClick={() => onUnarchive(directory.id)}>
            {t("workspace.settings.feedback_directories.unarchive")}
          </Button>
        )}
      </>
    ),
  },
];

export const FeedbackDirectoryTable = ({
  directories,
  organizationId,
  orgWorkspaces,
  workspaceAccessByWorkspace,
  membershipRole,
}: Readonly<FeedbackDirectoryTableProps>) => {
  const { t } = useTranslation();
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<TFeedbackDirectoryDetails>();
  const [showArchived, setShowArchived] = useState(false);
  const [loadingDirectoryId, setLoadingDirectoryId] = useState<string | null>(null);
  const router = useRouter();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;

  const handleManageDirectory = async (directoryId: string) => {
    setLoadingDirectoryId(directoryId);
    try {
      const response = await getFeedbackDirectoryDetailsAction({ directoryId });

      if (response?.data) {
        setSelectedDirectory(response.data);
        setOpenSettingsModal(true);
      } else {
        const errorCode = getFormattedErrorMessage(response);
        toast.error(getTranslatedFeedbackDirectoryError(errorCode, t));
      }
    } finally {
      setLoadingDirectoryId(null);
    }
  };

  const handleUnarchiveDirectory = async (directoryId: string) => {
    setLoadingDirectoryId(directoryId);
    try {
      const directoryDetailsResponse = await getFeedbackDirectoryDetailsAction({ directoryId });
      if (!directoryDetailsResponse?.data) {
        const errorCode = getFormattedErrorMessage(directoryDetailsResponse);
        toast.error(getTranslatedFeedbackDirectoryError(errorCode, t));
        return;
      }

      const workspaceAccessMap = new Map(
        workspaceAccessByWorkspace.map((assignment) => [assignment.workspaceId, assignment])
      );

      const hasConflicts = directoryDetailsResponse.data.workspaces.some((workspace) => {
        const assignment = workspaceAccessMap.get(workspace.workspaceId);
        return assignment && assignment.feedbackDirectoryId !== directoryId;
      });

      if (hasConflicts) {
        toast.error(t("workspace.settings.feedback_directories.unarchive_workspace_conflict"));
        return;
      }

      const response = await updateFeedbackDirectoryAction({
        directoryId,
        data: { isArchived: false },
      });
      if (response?.data) {
        toast.success(t("workspace.settings.feedback_directories.directory_unarchived_successfully"));
        router.refresh();
      } else {
        const errorCode = getFormattedErrorMessage(response);
        toast.error(getTranslatedFeedbackDirectoryError(errorCode, t));
      }
    } finally {
      setLoadingDirectoryId(null);
    }
  };

  const filteredDirectories = showArchived ? directories : directories.filter((d) => !d.isArchived);

  // Map each directory to a linked workspace the member can reach, so "View data" can deep-link
  // into that workspace's feedback records. Falls back to the first assigned org workspace.
  const orgWorkspaceIds = new Set(orgWorkspaces.map((workspace) => workspace.id));
  const viewDataWorkspaceIdByDirectory = new Map<string, string>();
  for (const assignment of workspaceAccessByWorkspace) {
    if (
      orgWorkspaceIds.has(assignment.workspaceId) &&
      !viewDataWorkspaceIdByDirectory.has(assignment.feedbackDirectoryId)
    ) {
      viewDataWorkspaceIdByDirectory.set(assignment.feedbackDirectoryId, assignment.workspaceId);
    }
  }

  return (
    <>
      {isOwnerOrManager && (
        // The table runs edge to edge, so the controls above it carry the card's gutter themselves.
        <div className="mb-4 flex items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-2">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            <span className="text-sm text-slate-500">
              {t("workspace.settings.feedback_directories.show_archived")}
            </span>
          </div>
          <Button size="sm" onClick={() => setOpenCreateModal(true)}>
            {t("workspace.settings.feedback_directories.create_feedback_directory")}
          </Button>
        </div>
      )}

      <SettingsTable
        columns={getFeedbackDirectoryColumns({
          t,
          isOwnerOrManager,
          loadingDirectoryId,
          viewDataWorkspaceIdByDirectory,
          onManage: handleManageDirectory,
          onUnarchive: handleUnarchiveDirectory,
        })}
        rows={filteredDirectories}
        getRowId={(directory) => directory.id}
        emptyMessage={t("workspace.settings.feedback_directories.empty_state")}
        aria-label={t("workspace.settings.feedback_directories.title")}
      />

      {openCreateModal && (
        <FeedbackDirectorySettingsModal
          open={openCreateModal}
          setOpen={setOpenCreateModal}
          organizationId={organizationId}
          orgWorkspaces={orgWorkspaces}
          workspaceAccessByWorkspace={workspaceAccessByWorkspace}
          membershipRole={membershipRole}
        />
      )}

      {openSettingsModal && selectedDirectory && (
        <FeedbackDirectorySettingsModal
          open={openSettingsModal}
          setOpen={setOpenSettingsModal}
          directory={selectedDirectory}
          organizationId={organizationId}
          orgWorkspaces={orgWorkspaces}
          workspaceAccessByWorkspace={workspaceAccessByWorkspace}
          membershipRole={membershipRole}
        />
      )}
    </>
  );
};
