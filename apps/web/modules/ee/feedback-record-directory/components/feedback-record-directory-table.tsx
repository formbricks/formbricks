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
import { CreateFeedbackRecordDirectoryModal } from "@/modules/ee/feedback-record-directory/components/create-feedback-record-directory-modal";
import { FeedbackRecordDirectorySettingsModal } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-settings/feedback-record-directory-settings-modal";
import {
  TFeedbackRecordDirectory,
  TFeedbackRecordDirectoryDetails,
} from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";
import { TOrganizationProject } from "@/modules/ee/teams/team-list/types/project";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";

interface FeedbackRecordDirectoryTableProps {
  directories: TFeedbackRecordDirectory[];
  organizationId: string;
  orgProjects: TOrganizationProject[];
  membershipRole?: TOrganizationRole;
}

export const FeedbackRecordDirectoryTable = ({
  directories,
  organizationId,
  orgProjects,
  membershipRole,
}: FeedbackRecordDirectoryTableProps) => {
  const { t } = useTranslation();
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openSettingsModal, setOpenSettingsModal] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<TFeedbackRecordDirectoryDetails>();
  const [showArchived, setShowArchived] = useState(false);
  const router = useRouter();

  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;

  const handleManageDirectory = async (directoryId: string) => {
    const response = await getFeedbackRecordDirectoryDetailsAction({ directoryId });

    if (response?.data) {
      setSelectedDirectory(response.data);
      setOpenSettingsModal(true);
    } else {
      const errorMessage = getFormattedErrorMessage(response);
      toast.error(errorMessage);
    }
  };

  const handleUnarchiveDirectory = async (directoryId: string) => {
    const response = await updateFeedbackRecordDirectoryAction({ directoryId, data: { isArchived: false } });
    if (response?.data) {
      toast.success(t("environments.settings.feedback_record_directories.directory_unarchived_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(response);
      toast.error(errorMessage);
    }
  };

  const filteredDirectories = showArchived ? directories : directories.filter((d) => !d.isArchived);

  return (
    <>
      {isOwnerOrManager && (
        <div className="mb-4 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-500">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300"
            />
            {t("environments.settings.feedback_record_directories.show_archived")}
          </label>
          <Button size="sm" onClick={() => setOpenCreateModal(true)}>
            {t("environments.settings.feedback_record_directories.create_feedback_directory")}
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border" aria-label="Feedback record directories list">
        <Table>
          <TableHeader role="rowgroup">
            <TableRow className="bg-slate-100" role="row">
              <TableHead className="font-medium text-slate-500">
                {t("environments.settings.feedback_record_directories.directory_name")}
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
                  {t("environments.settings.feedback_record_directories.empty_state")}
                </TableCell>
              </TableRow>
            )}
            {filteredDirectories.map((directory) => (
              <TableRow key={directory.id} className="hover:bg-transparent">
                <TableCell>{directory.name}</TableCell>
                <TableCell>{directory.projectCount}</TableCell>
                <TableCell>
                  {directory.isArchived ? (
                    <Badge type="gray" size="tiny" text={t("common.archived")} />
                  ) : (
                    <Badge type="success" size="tiny" text={t("common.active")} />
                  )}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  {isOwnerOrManager && !directory.isArchived && (
                    <Button size="sm" variant="secondary" onClick={() => handleManageDirectory(directory.id)}>
                      {t("common.manage")}
                    </Button>
                  )}
                  {isOwnerOrManager && directory.isArchived && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleUnarchiveDirectory(directory.id)}>
                      {t("environments.settings.feedback_record_directories.unarchive")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateFeedbackRecordDirectoryModal
        open={openCreateModal}
        setOpen={setOpenCreateModal}
        organizationId={organizationId}
      />

      {openSettingsModal && selectedDirectory && (
        <FeedbackRecordDirectorySettingsModal
          open={openSettingsModal}
          setOpen={setOpenSettingsModal}
          directory={selectedDirectory}
          orgProjects={orgProjects}
          membershipRole={membershipRole}
        />
      )}
    </>
  );
};
