"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormProvider, SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import {
  createFeedbackRecordDirectoryAction,
  updateFeedbackRecordDirectoryAction,
} from "@/modules/ee/feedback-record-directory/actions";
import { ArchiveFeedbackRecordDirectory } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-settings/archive-feedback-record-directory";
import {
  TFeedbackRecordDirectoryDetails,
  TFeedbackRecordDirectoryUpdateInput,
  TWorkspaceFeedbackRecordDirectoryAccess,
  ZFeedbackRecordDirectoryUpdateInput,
  getTranslatedFeedbackRecordDirectoryError,
} from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";
import { TOrganizationWorkspace } from "@/modules/ee/teams/team-list/types/workspace";
import { Button } from "@/modules/ui/components/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import { Muted } from "@/modules/ui/components/typography";

interface FeedbackRecordDirectorySettingsModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  directory?: TFeedbackRecordDirectoryDetails;
  organizationId: string;
  orgWorkspaces: TOrganizationWorkspace[];
  workspaceAccessByWorkspace: TWorkspaceFeedbackRecordDirectoryAccess[];
  membershipRole: TOrganizationRole;
}

export const FeedbackRecordDirectorySettingsModal = ({
  open,
  setOpen,
  directory,
  organizationId,
  orgWorkspaces,
  workspaceAccessByWorkspace,
  membershipRole,
}: Readonly<FeedbackRecordDirectorySettingsModalProps>) => {
  const { t } = useTranslation();
  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const router = useRouter();
  const isEdit = !!directory;

  const [confirmPauseDialogOpen, setConfirmPauseDialogOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<TFeedbackRecordDirectoryUpdateInput | null>(
    null
  );
  const [connectorsToPauseCount, setConnectorsToPauseCount] = useState(0);

  const workspaceAccessMap = useMemo(
    () => new Map(workspaceAccessByWorkspace.map((assignment) => [assignment.workspaceId, assignment])),
    [workspaceAccessByWorkspace]
  );

  const workspaceOptions = useMemo(
    () =>
      orgWorkspaces
        .map((workspace) => {
          const assignment = workspaceAccessMap.get(workspace.id);
          const isAssignedToDifferentDirectory = Boolean(
            assignment && assignment.feedbackRecordDirectoryId !== directory?.id
          );

          return {
            value: workspace.id,
            label: workspace.name,
            disabled: isAssignedToDifferentDirectory,
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    [orgWorkspaces, workspaceAccessMap, directory?.id]
  );

  const initialWorkspaceIds = useMemo(
    () => directory?.workspaces.map((workspace) => workspace.workspaceId) ?? [],
    [directory?.workspaces]
  );

  const form = useForm<TFeedbackRecordDirectoryUpdateInput>({
    defaultValues: {
      name: directory?.name ?? "",
      workspaceIds: initialWorkspaceIds,
    },
    mode: "onChange",
    resolver: zodResolver(ZFeedbackRecordDirectoryUpdateInput),
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    setValue,
    reset,
  } = form;

  const closeModal = () => {
    setConfirmPauseDialogOpen(false);
    setPendingSubmitData(null);
    setConnectorsToPauseCount(0);
    reset();
    setOpen(false);
  };

  const submitDirectory = async (
    data: TFeedbackRecordDirectoryUpdateInput,
    pauseConnectorsInRemovedWorkspaces: boolean
  ) => {
    const response =
      isEdit && directory
        ? await updateFeedbackRecordDirectoryAction({
            directoryId: directory.id,
            data: { name: data.name, workspaceIds: data.workspaceIds },
            pauseConnectorsInRemovedWorkspaces,
          })
        : await createFeedbackRecordDirectoryAction({
            organizationId,
            name: data.name ?? "",
            workspaceIds: data.workspaceIds,
          });

    if (response?.data) {
      toast.success(
        isEdit
          ? t("workspace.settings.feedback_record_directories.directory_updated_successfully")
          : t("workspace.settings.feedback_record_directories.directory_created_successfully")
      );
      closeModal();
      router.refresh();
      return true;
    } else {
      const errorCode = getFormattedErrorMessage(response);
      toast.error(getTranslatedFeedbackRecordDirectoryError(errorCode, t));
      return false;
    }
  };

  const handleConfirmPauseAndSubmit = async () => {
    if (!pendingSubmitData) {
      return;
    }

    const wasSuccessful = await submitDirectory(pendingSubmitData, true);
    if (wasSuccessful) {
      setConfirmPauseDialogOpen(false);
      setPendingSubmitData(null);
      setConnectorsToPauseCount(0);
    }
  };

  const handleSubmitForm: SubmitHandler<TFeedbackRecordDirectoryUpdateInput> = async (data) => {
    if (!isEdit || !directory) {
      await submitDirectory(data, false);
      return;
    }

    const updatedWorkspaceIds = data.workspaceIds ?? [];
    const removedWorkspaceIds = initialWorkspaceIds.filter(
      (workspaceId) => !updatedWorkspaceIds.includes(workspaceId)
    );

    if (removedWorkspaceIds.length > 0) {
      const affectedConnectors = directory.connectors.filter((connector) =>
        removedWorkspaceIds.includes(connector.workspaceId)
      );

      if (affectedConnectors.length > 0) {
        setPendingSubmitData(data);
        setConnectorsToPauseCount(affectedConnectors.length);
        setConfirmPauseDialogOpen(true);
        return;
      }
    }

    await submitDirectory(data, false);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => (newOpen ? setOpen(true) : closeModal())}>
      <DialogContent>
        <DialogHeader className="pb-4">
          <DialogTitle>
            {isEdit
              ? t("workspace.settings.feedback_record_directories.directory_settings_title", {
                  directoryName: directory.name,
                })
              : t("workspace.settings.feedback_record_directories.create_feedback_directory")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("workspace.settings.feedback_record_directories.directory_settings_description")
              : t("workspace.settings.feedback_record_directories.create_feedback_directory")}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form className="contents space-y-4" onSubmit={handleSubmit(handleSubmitForm)}>
            <DialogBody className="flex-grow space-y-6 overflow-y-auto">
              <FormField
                control={control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>
                      {t("workspace.settings.feedback_record_directories.directory_name")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t("workspace.settings.feedback_record_directories.directory_name")}
                        {...field}
                        disabled={!isOwnerOrManager}
                      />
                    </FormControl>
                    {error?.message && (
                      <FormError className="text-left">
                        {getTranslatedFeedbackRecordDirectoryError(error.message, t)}
                      </FormError>
                    )}
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>{t("workspace.settings.feedback_record_directories.workspace_access")}</FormLabel>
                <Muted className="block text-slate-500">
                  {t("workspace.settings.feedback_record_directories.assign_workspaces_description")}
                </Muted>
                <MultiSelect
                  options={workspaceOptions}
                  value={form.watch("workspaceIds") ?? []}
                  onChange={(selected) => {
                    setValue("workspaceIds", selected, { shouldDirty: true });
                  }}
                  disabled={!isOwnerOrManager}
                  placeholder={t(
                    "workspace.settings.feedback_record_directories.select_workspaces_placeholder"
                  )}
                  containerClassName="focus-within:ring-0 focus-within:ring-offset-0"
                />
              </div>

              {isEdit && (
                <div className="space-y-2">
                  <FormLabel>{t("workspace.unify.connectors")}</FormLabel>
                  <Muted className="block text-slate-500">
                    {t("workspace.settings.feedback_record_directories.connectors_description")}
                  </Muted>
                  {directory.connectors.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-sm text-slate-400">
                      {t("workspace.settings.feedback_record_directories.no_connectors")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {directory.connectors.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                          <div>
                            <p className="font-medium text-slate-900">{c.name}</p>
                            <p className="text-xs text-slate-500">
                              {c.type} · {c.workspaceName}
                            </p>
                          </div>
                          <a
                            className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline"
                            href={`/workspaces/${c.workspaceId}/feedback-sources`}>
                            {t("common.view")}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {isEdit && (
                <IdBadge
                  id={directory.id}
                  label={t("workspace.settings.feedback_record_directories.directory_id")}
                  variant="column"
                />
              )}
            </DialogBody>
            <DialogFooter>
              {isEdit && (
                <div className="w-full">
                  <ArchiveFeedbackRecordDirectory
                    directoryId={directory.id}
                    onArchive={closeModal}
                    isOwnerOrManager={isOwnerOrManager}
                  />
                </div>
              )}
              <Button size="default" type="button" variant="outline" onClick={closeModal}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="default" loading={isSubmitting} disabled={!isOwnerOrManager}>
                {isEdit ? t("common.save") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>

      {confirmPauseDialogOpen && (
        <Dialog open={confirmPauseDialogOpen} onOpenChange={setConfirmPauseDialogOpen}>
          <DialogContent width="narrow" hideCloseButton={true} disableCloseOnOutsideClick={true}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CircleAlert className="h-4 w-4" />
                <DialogTitle>
                  {t("workspace.settings.feedback_record_directories.pause_connectors_confirmation_title")}
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogBody>
              <p>
                {t(
                  "workspace.settings.feedback_record_directories.pause_connectors_confirmation_description",
                  {
                    count: connectorsToPauseCount,
                  }
                )}
              </p>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmPauseDialogOpen(false);
                  setPendingSubmitData(null);
                  setConnectorsToPauseCount(0);
                }}
                disabled={isSubmitting}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleConfirmPauseAndSubmit} loading={isSubmitting}>
                {t("common.continue")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
};
