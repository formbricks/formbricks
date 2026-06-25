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
  createFeedbackDirectoryAction,
  updateFeedbackDirectoryAction,
} from "@/modules/ee/feedback-directory/actions";
import { ArchiveFeedbackDirectory } from "@/modules/ee/feedback-directory/components/feedback-directory-settings/archive-feedback-directory";
import { getWorkspaceAccessConflictState } from "@/modules/ee/feedback-directory/lib/workspace-access-conflicts";
import {
  TFeedbackDirectoryDetails,
  TFeedbackDirectoryUpdateInput,
  TWorkspaceFeedbackDirectoryAccess,
  ZFeedbackDirectoryUpdateInput,
  getTranslatedFeedbackDirectoryError,
} from "@/modules/ee/feedback-directory/types/feedback-directory";
import { TOrganizationWorkspace } from "@/modules/ee/teams/team-list/types/workspace";
import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
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

interface FeedbackDirectorySettingsModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  directory?: TFeedbackDirectoryDetails;
  organizationId: string;
  orgWorkspaces: TOrganizationWorkspace[];
  workspaceAccessByWorkspace: TWorkspaceFeedbackDirectoryAccess[];
  membershipRole: TOrganizationRole;
}

export const FeedbackDirectorySettingsModal = ({
  open,
  setOpen,
  directory,
  organizationId,
  orgWorkspaces,
  workspaceAccessByWorkspace,
  membershipRole,
}: Readonly<FeedbackDirectorySettingsModalProps>) => {
  const { t } = useTranslation();
  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const router = useRouter();
  const isEdit = !!directory;

  const [confirmPauseDialogOpen, setConfirmPauseDialogOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<TFeedbackDirectoryUpdateInput | null>(null);
  const [feedbackSourcesToPauseCount, setFeedbackSourcesToPauseCount] = useState(0);

  const [confirmAddDialogOpen, setConfirmAddDialogOpen] = useState(false);
  const [pendingAddData, setPendingAddData] = useState<TFeedbackDirectoryUpdateInput | null>(null);
  const [addedWorkspaceIds, setAddedWorkspaceIds] = useState<string[]>([]);

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
            assignment && assignment.feedbackDirectoryId !== directory?.id
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

  const workspaceConflictInput = useMemo(
    () => ({
      orgWorkspaces,
      workspaceAccessByWorkspace,
      currentDirectoryId: directory?.id,
    }),
    [orgWorkspaces, workspaceAccessByWorkspace, directory?.id]
  );

  const workspaceConflictState = useMemo(
    () => getWorkspaceAccessConflictState(workspaceConflictInput),
    [workspaceConflictInput]
  );

  const initialWorkspaceIds = useMemo(
    () => directory?.workspaces.map((workspace) => workspace.workspaceId) ?? [],
    [directory?.workspaces]
  );

  const form = useForm<TFeedbackDirectoryUpdateInput>({
    defaultValues: {
      name: directory?.name ?? "",
      workspaceIds: initialWorkspaceIds,
    },
    mode: "onChange",
    resolver: zodResolver(ZFeedbackDirectoryUpdateInput),
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    setValue,
    reset,
  } = form;
  const selectedWorkspaceIds = form.watch("workspaceIds") ?? [];

  const workspaceNameById = useMemo(() => {
    const map = new Map(orgWorkspaces.map((workspace) => [workspace.id, workspace.name]));
    directory?.workspaces.forEach((workspace) => {
      if (!map.has(workspace.workspaceId)) {
        map.set(workspace.workspaceId, workspace.workspaceName);
      }
    });
    return map;
  }, [orgWorkspaces, directory?.workspaces]);

  const closeModal = () => {
    setConfirmPauseDialogOpen(false);
    setPendingSubmitData(null);
    setFeedbackSourcesToPauseCount(0);
    setConfirmAddDialogOpen(false);
    setPendingAddData(null);
    setAddedWorkspaceIds([]);
    reset();
    setOpen(false);
  };

  const submitDirectory = async (
    data: TFeedbackDirectoryUpdateInput,
    pauseFeedbackSourcesInRemovedWorkspaces: boolean
  ) => {
    const response =
      isEdit && directory
        ? await updateFeedbackDirectoryAction({
            directoryId: directory.id,
            data: { name: data.name, workspaceIds: data.workspaceIds },
            pauseFeedbackSourcesInRemovedWorkspaces,
          })
        : await createFeedbackDirectoryAction({
            organizationId,
            name: data.name ?? "",
            workspaceIds: data.workspaceIds,
          });

    if (response?.data) {
      toast.success(
        isEdit
          ? t("workspace.settings.feedback_directories.directory_updated_successfully")
          : t("workspace.settings.feedback_directories.directory_created_successfully")
      );
      closeModal();
      router.refresh();
      return true;
    } else {
      const errorCode = getFormattedErrorMessage(response);
      toast.error(getTranslatedFeedbackDirectoryError(errorCode, t));
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
      setFeedbackSourcesToPauseCount(0);
    }
  };

  const proceedAfterAddConfirm = async (data: TFeedbackDirectoryUpdateInput) => {
    if (!isEdit || !directory) {
      await submitDirectory(data, false);
      return;
    }

    const updatedWorkspaceIds = data.workspaceIds ?? [];
    const removedWorkspaceIds = initialWorkspaceIds.filter(
      (workspaceId) => !updatedWorkspaceIds.includes(workspaceId)
    );

    if (removedWorkspaceIds.length > 0) {
      const affectedFeedbackSources = directory.feedbackSources.filter((feedbackSource) =>
        removedWorkspaceIds.includes(feedbackSource.workspaceId)
      );

      if (affectedFeedbackSources.length > 0) {
        setPendingSubmitData(data);
        setFeedbackSourcesToPauseCount(affectedFeedbackSources.length);
        setConfirmPauseDialogOpen(true);
        return;
      }
    }

    await submitDirectory(data, false);
  };

  const handleConfirmAddAndContinue = async () => {
    if (!pendingAddData) return;

    setConfirmAddDialogOpen(false);
    setAddedWorkspaceIds([]);

    const data = pendingAddData;
    setPendingAddData(null);

    await proceedAfterAddConfirm(data);
  };

  const handleSubmitForm: SubmitHandler<TFeedbackDirectoryUpdateInput> = async (data) => {
    const updatedWorkspaceIds = data.workspaceIds ?? [];
    const newlyAddedWorkspaceIds = updatedWorkspaceIds.filter(
      (workspaceId) => !initialWorkspaceIds.includes(workspaceId)
    );

    if (newlyAddedWorkspaceIds.length > 0) {
      setPendingAddData(data);
      setAddedWorkspaceIds(newlyAddedWorkspaceIds);
      setConfirmAddDialogOpen(true);
      return;
    }

    await proceedAfterAddConfirm(data);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => (newOpen ? setOpen(true) : closeModal())}>
      <DialogContent>
        <DialogHeader className="pb-4">
          <DialogTitle>
            {isEdit
              ? t("workspace.settings.feedback_directories.directory_settings_title", {
                  directoryName: directory.name,
                })
              : t("workspace.settings.feedback_directories.create_feedback_directory")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("workspace.settings.feedback_directories.directory_settings_description")
              : t("workspace.settings.feedback_directories.create_feedback_directory")}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form className="contents space-y-4" onSubmit={handleSubmit(handleSubmitForm)}>
            <DialogBody className="grow space-y-6 overflow-y-auto">
              <FormField
                control={control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("workspace.settings.feedback_directories.directory_name")}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t("workspace.settings.feedback_directories.directory_name")}
                        {...field}
                        disabled={!isOwnerOrManager}
                      />
                    </FormControl>
                    {error?.message && (
                      <FormError className="text-left">
                        {getTranslatedFeedbackDirectoryError(error.message, t)}
                      </FormError>
                    )}
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>{t("workspace.settings.feedback_directories.workspace_access")}</FormLabel>
                <Muted className="block text-slate-500">
                  {t("workspace.settings.feedback_directories.assign_workspaces_description")}
                </Muted>
                <MultiSelect
                  options={workspaceOptions}
                  value={selectedWorkspaceIds}
                  onChange={(selected) => {
                    setValue("workspaceIds", selected, { shouldDirty: true });
                  }}
                  disabled={!isOwnerOrManager}
                  placeholder={t("workspace.settings.feedback_directories.select_workspaces_placeholder")}
                  containerClassName="focus-within:ring-0 focus-within:ring-offset-0"
                />
                {workspaceConflictState.showBlockedExplanation && (
                  <Alert variant="info" className="items-start">
                    <div className="min-w-0 space-y-1">
                      <AlertTitle className="truncate">
                        {t("workspace.settings.feedback_directories.no_unassigned_workspaces_title")}
                      </AlertTitle>
                      <AlertDescription className="overflow-visible whitespace-normal">
                        <p>
                          {t("workspace.settings.feedback_directories.no_unassigned_workspaces_description")}
                        </p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                          {workspaceConflictState.conflictDetails.map((conflict) => (
                            <li key={conflict.workspaceId}>
                              {t("workspace.settings.feedback_directories.workspace_assigned_to_directory", {
                                workspaceName: conflict.workspaceName,
                                directoryName: conflict.feedbackDirectoryName,
                              })}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </div>

              {isEdit && (
                <div className="space-y-2">
                  <FormLabel>{t("workspace.unify.sources")}</FormLabel>
                  <Muted className="block text-slate-500">
                    {t("workspace.settings.feedback_directories.feedback_sources_description")}
                  </Muted>
                  {directory.feedbackSources.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-200 p-3 text-center text-sm text-slate-400">
                      {t("workspace.settings.feedback_directories.no_feedback_sources")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {directory.feedbackSources.map((c) => (
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
                            href={`/workspaces/${c.workspaceId}/settings/workspace/feedback-sources`}>
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
                  label={t("workspace.settings.feedback_directories.directory_id")}
                  variant="column"
                />
              )}
            </DialogBody>
            <DialogFooter>
              {isEdit && (
                <div className="w-full">
                  <ArchiveFeedbackDirectory
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

      {confirmAddDialogOpen && (
        <Dialog open={confirmAddDialogOpen} onOpenChange={setConfirmAddDialogOpen}>
          <DialogContent width="narrow" hideCloseButton={true} disableCloseOnOutsideClick={true}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CircleAlert className="size-4 text-red-600" />
                <DialogTitle>
                  {t("workspace.settings.feedback_directories.grant_workspace_access_title")}
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <p className="text-sm text-slate-700">
                {t("workspace.settings.feedback_directories.grant_workspace_access_warning", {
                  directoryName: form.watch("name") || directory?.name || "",
                })}
              </p>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">
                  {t("workspace.settings.feedback_directories.workspaces_being_added")}
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                  {addedWorkspaceIds.map((id) => (
                    <li key={id}>{workspaceNameById.get(id) ?? id}</li>
                  ))}
                </ul>
              </div>
              {isEdit && initialWorkspaceIds.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    {t("workspace.settings.feedback_directories.workspaces_already_linked")}
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                    {initialWorkspaceIds.map((id) => (
                      <li key={id}>{workspaceNameById.get(id) ?? id}</li>
                    ))}
                  </ul>
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmAddDialogOpen(false);
                  setPendingAddData(null);
                  setAddedWorkspaceIds([]);
                }}
                disabled={isSubmitting}>
                {t("common.cancel")}
              </Button>
              <Button variant="destructive" onClick={handleConfirmAddAndContinue} loading={isSubmitting}>
                {t("workspace.settings.feedback_directories.grant_access_confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {confirmPauseDialogOpen && (
        <Dialog open={confirmPauseDialogOpen} onOpenChange={setConfirmPauseDialogOpen}>
          <DialogContent width="narrow" hideCloseButton={true} disableCloseOnOutsideClick={true}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CircleAlert className="size-4" />
                <DialogTitle>
                  {t("workspace.settings.feedback_directories.pause_feedback_sources_confirmation_title")}
                </DialogTitle>
              </div>
            </DialogHeader>
            <DialogBody>
              <p>
                {t(
                  "workspace.settings.feedback_directories.pause_feedback_sources_confirmation_description",
                  {
                    count: feedbackSourcesToPauseCount,
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
                  setFeedbackSourcesToPauseCount(0);
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
