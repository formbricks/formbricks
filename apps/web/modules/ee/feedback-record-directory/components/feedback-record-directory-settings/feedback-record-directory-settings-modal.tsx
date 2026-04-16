"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
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

interface FeedbackRecordDirectoryFormModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  directory?: TFeedbackRecordDirectoryDetails;
  organizationId: string;
  orgWorkspaces: TOrganizationWorkspace[];
  membershipRole: TOrganizationRole;
}

export const FeedbackRecordDirectorySettingsModal = ({
  open,
  setOpen,
  directory,
  organizationId,
  orgWorkspaces,
  membershipRole,
}: FeedbackRecordDirectoryFormModalProps) => {
  const { t } = useTranslation();
  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const router = useRouter();
  const isEdit = !!directory;

  const workspaceOptions = useMemo(
    () =>
      orgWorkspaces
        .map((p) => ({ value: p.id, label: p.name }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    [orgWorkspaces]
  );

  const initialWorkspaceIds = useMemo(
    () => directory?.workspaces.map((p) => p.workspaceId) ?? [],
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
    reset();
    setOpen(false);
  };

  const handleSubmitForm: SubmitHandler<TFeedbackRecordDirectoryUpdateInput> = async (data) => {
    const response = isEdit
      ? await updateFeedbackRecordDirectoryAction({
          directoryId: directory.id,
          data: { name: data.name, workspaceIds: data.workspaceIds },
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
    } else {
      const errorCode = getFormattedErrorMessage(response);
      toast.error(getTranslatedFeedbackRecordDirectoryError(errorCode, t));
    }
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
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />

              {isEdit && (
                <IdBadge
                  id={directory.id}
                  label={t("workspace.settings.feedback_record_directories.directory_id")}
                  variant="column"
                />
              )}

              <div className="space-y-2">
                <FormLabel>{t("common.workspaces")}</FormLabel>
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
                            href={`/workspaces/${c.workspaceId}/unify/sources`}>
                            {t("common.view")}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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
    </Dialog>
  );
};
