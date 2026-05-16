"use client";

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
import { Switch } from "@/modules/ui/components/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";

interface FeedbackDirectoryTableProps {
  directories: TFeedbackDirectory[];
  organizationId: string;
  orgWorkspaces: TOrganizationWorkspace[];
  workspaceAccessByWorkspace: TWorkspaceFeedbackDirectoryAccess[];
  membershipRole: TOrganizationRole;
}

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

  return (
    <>
      {isOwnerOrManager && (
        <div className="mb-4 flex items-center justify-between">
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

      <div className="overflow-hidden rounded-lg border" aria-label="Feedback directories list">
        <Table>
          <TableHeader role="rowgroup">
            <TableRow className="bg-slate-100" role="row">
              <TableHead className="font-medium text-slate-500">
                {t("workspace.settings.feedback_directories.directory_name")}
              </TableHead>
              <TableHead className="font-medium text-slate-500">{t("common.workspaces")}</TableHead>
              <TableHead className="font-medium text-slate-500">{t("common.status")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-b">
            {filteredDirectories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center hover:bg-transparent">
                  {t("workspace.settings.feedback_directories.empty_state")}
                </TableCell>
              </TableRow>
            )}
            {filteredDirectories.map((directory) => (
              <TableRow key={directory.id} className="hover:bg-transparent">
                <TableCell>{directory.name}</TableCell>
                <TableCell>{directory.workspaceCount}</TableCell>
                <TableCell>
                  {directory.isArchived ? (
                    <Badge type="gray" size="tiny" text={t("common.archived")} />
                  ) : (
                    <Badge type="success" size="tiny" text={t("common.active")} />
                  )}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  {isOwnerOrManager && !directory.isArchived && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={loadingDirectoryId === directory.id}
                      disabled={loadingDirectoryId !== null}
                      onClick={() => handleManageDirectory(directory.id)}>
                      {t("common.manage")}
                    </Button>
                  )}
                  {isOwnerOrManager && directory.isArchived && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={loadingDirectoryId === directory.id}
                      disabled={loadingDirectoryId !== null}
                      onClick={() => handleUnarchiveDirectory(directory.id)}>
                      {t("workspace.settings.feedback_directories.unarchive")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
