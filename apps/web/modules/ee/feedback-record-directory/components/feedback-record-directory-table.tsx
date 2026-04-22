"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  getFeedbackRecordDirectoryDetailsAction,
  updateFeedbackRecordDirectoryAction,
} from "@/modules/ee/feedback-record-directory/actions";
import { FeedbackRecordDirectorySettingsModal } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-settings/feedback-record-directory-settings-modal";
import {
  TFeedbackRecordDirectory,
  TFeedbackRecordDirectoryDetails,
  getTranslatedFeedbackRecordDirectoryError,
} from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";
import { TOrganizationWorkspace } from "@/modules/ee/teams/team-list/types/workspace";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Switch } from "@/modules/ui/components/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";

interface FeedbackRecordDirectoryTableProps {
  directories: TFeedbackRecordDirectory[];
  organizationId: string;
  orgWorkspaces: TOrganizationWorkspace[];
  membershipRole: TOrganizationRole;
}

export const FeedbackRecordDirectoryTable = ({
  directories,
  organizationId,
  orgWorkspaces,
  membershipRole,
}: FeedbackRecordDirectoryTableProps) => {
  const { t } = useTranslation();
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<TFeedbackRecordDirectoryDetails>();
  const [showArchived, setShowArchived] = useState(false);
  const [loadingDirectoryId, setLoadingDirectoryId] = useState<string | null>(null);
  const router = useRouter();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;

  const handleManageDirectory = async (directoryId: string) => {
    setLoadingDirectoryId(directoryId);
    try {
      const response = await getFeedbackRecordDirectoryDetailsAction({ directoryId });

      if (response?.data) {
        setSelectedDirectory(response.data);
        setOpenSettingsModal(true);
      } else {
        const errorCode = getFormattedErrorMessage(response);
        toast.error(getTranslatedFeedbackRecordDirectoryError(errorCode, t));
      }
    } finally {
      setLoadingDirectoryId(null);
    }
  };

  const handleUnarchiveDirectory = async (directoryId: string) => {
    setLoadingDirectoryId(directoryId);
    try {
      const response = await updateFeedbackRecordDirectoryAction({
        directoryId,
        data: { isArchived: false },
      });
      if (response?.data) {
        toast.success(t("workspace.settings.feedback_record_directories.directory_unarchived_successfully"));
        router.refresh();
      } else {
        const errorCode = getFormattedErrorMessage(response);
        toast.error(getTranslatedFeedbackRecordDirectoryError(errorCode, t));
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
              {t("workspace.settings.feedback_record_directories.show_archived")}
            </span>
          </div>
          <Button size="sm" onClick={() => setOpenCreateModal(true)}>
            {t("workspace.settings.feedback_record_directories.create_feedback_directory")}
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border" aria-label="Feedback record directories list">
        <Table>
          <TableHeader role="rowgroup">
            <TableRow className="bg-slate-100" role="row">
              <TableHead className="font-medium text-slate-500">
                {t("workspace.settings.feedback_record_directories.directory_name")}
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
                  {t("workspace.settings.feedback_record_directories.empty_state")}
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
                      {t("workspace.settings.feedback_record_directories.unarchive")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {openCreateModal && (
        <FeedbackRecordDirectorySettingsModal
          open={openCreateModal}
          setOpen={setOpenCreateModal}
          organizationId={organizationId}
          orgWorkspaces={orgWorkspaces}
          membershipRole={membershipRole}
        />
      )}

      {openSettingsModal && selectedDirectory && (
        <FeedbackRecordDirectorySettingsModal
          open={openSettingsModal}
          setOpen={setOpenSettingsModal}
          directory={selectedDirectory}
          organizationId={organizationId}
          orgWorkspaces={orgWorkspaces}
          membershipRole={membershipRole}
        />
      )}
    </>
  );
};
