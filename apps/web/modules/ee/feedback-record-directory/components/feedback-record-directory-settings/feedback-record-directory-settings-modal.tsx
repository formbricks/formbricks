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
import { updateFeedbackRecordDirectoryAction } from "@/modules/ee/feedback-record-directory/actions";
import { ArchiveFeedbackRecordDirectory } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-settings/archive-feedback-record-directory";
import {
  TFeedbackRecordDirectoryDetails,
  TFeedbackRecordDirectoryUpdateInput,
  ZFeedbackRecordDirectoryUpdateInput,
} from "@/modules/ee/feedback-record-directory/types/feedback-record-directory";
import { TOrganizationProject } from "@/modules/ee/teams/team-list/types/project";
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
  directory: TFeedbackRecordDirectoryDetails;
  orgProjects: TOrganizationProject[];
  membershipRole?: TOrganizationRole;
}

export const FeedbackRecordDirectorySettingsModal = ({
  open,
  setOpen,
  directory,
  orgProjects,
  membershipRole,
}: FeedbackRecordDirectorySettingsModalProps) => {
  const { t } = useTranslation();
  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const isOwnerOrManager = isOwner || isManager;
  const router = useRouter();

  const projectOptions = useMemo(
    () =>
      orgProjects
        .map((p) => ({ value: p.id, label: p.name }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    [orgProjects]
  );

  const initialProjectIds = useMemo(() => directory.projects.map((p) => p.projectId), [directory.projects]);

  const form = useForm<TFeedbackRecordDirectoryUpdateInput>({
    defaultValues: {
      name: directory.name,
      projectIds: initialProjectIds,
    },
    mode: "onChange",
    resolver: zodResolver(ZFeedbackRecordDirectoryUpdateInput),
  });

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
    setValue,
  } = form;

  const closeSettingsModal = () => {
    setOpen(false);
  };

  const handleUpdate: SubmitHandler<TFeedbackRecordDirectoryUpdateInput> = async (data) => {
    const response = await updateFeedbackRecordDirectoryAction({
      directoryId: directory.id,
      data: {
        name: data.name,
        projectIds: data.projectIds,
      },
    });

    if (response?.data) {
      toast.success(t("environments.settings.feedback_record_directories.directory_updated_successfully"));
      closeSettingsModal();
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(response);
      toast.error(errorMessage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader className="pb-4">
          <DialogTitle>
            {t("environments.settings.feedback_record_directories.directory_settings_title", {
              directoryName: directory.name,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("environments.settings.feedback_record_directories.directory_settings_description")}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form className="contents space-y-4" onSubmit={handleSubmit(handleUpdate)}>
            <DialogBody className="flex-grow space-y-6 overflow-y-auto">
              <FormField
                control={control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>
                      {t("environments.settings.feedback_record_directories.directory_name")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t("environments.settings.feedback_record_directories.directory_name")}
                        {...field}
                        disabled={!isOwnerOrManager}
                      />
                    </FormControl>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />

              <IdBadge
                id={directory.id}
                label={t("environments.settings.feedback_record_directories.directory_id")}
                variant="column"
              />

              <div className="space-y-2">
                <FormLabel>{t("common.workspaces")}</FormLabel>
                <Muted className="block text-slate-500">
                  {t("environments.settings.feedback_record_directories.assign_workspaces_description")}
                </Muted>
                <MultiSelect
                  options={projectOptions}
                  value={form.watch("projectIds")}
                  onChange={(selected) => {
                    setValue("projectIds", selected, { shouldDirty: true });
                  }}
                  disabled={!isOwnerOrManager}
                  placeholder={t(
                    "environments.settings.feedback_record_directories.select_workspaces_placeholder"
                  )}
                  containerClassName="focus-within:ring-0 focus-within:ring-offset-0"
                />
              </div>
            </DialogBody>
            <DialogFooter>
              <div className="w-full">
                <ArchiveFeedbackRecordDirectory
                  directoryId={directory.id}
                  onArchive={closeSettingsModal}
                  isOwnerOrManager={isOwnerOrManager}
                />
              </div>
              <Button size="default" type="button" variant="outline" onClick={closeSettingsModal}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="default" loading={isSubmitting} disabled={!isOwnerOrManager}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
