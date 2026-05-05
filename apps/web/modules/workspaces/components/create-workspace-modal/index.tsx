"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ZWorkspace } from "@formbricks/types/workspace";
import { TOrganizationTeam } from "@/app/(app)/(onboarding)/types/onboarding";
import { createWorkspaceAction } from "@/app/(app)/workspaces/[workspaceId]/actions";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
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
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import {
  getFeedbackDirectoriesByOrganizationIdAction,
  getTeamsByOrganizationIdAction,
} from "@/modules/workspaces/settings/actions";

const ZCreateWorkspaceForm = z.object({
  name: ZWorkspace.shape.name,
  teamIds: z.array(z.string()).optional(),
  feedbackDirectoryId: z.string().optional(),
});

type TCreateWorkspaceForm = z.infer<typeof ZCreateWorkspaceForm>;

interface CreateWorkspaceModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  organizationId: string;
  isAccessControlAllowed: boolean;
}

export const CreateWorkspaceModal = ({
  open,
  setOpen,
  organizationId,
  isAccessControlAllowed,
}: CreateWorkspaceModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const [organizationTeams, setOrganizationTeams] = useState<TOrganizationTeam[]>([]);
  const [feedbackDirectories, setFeedbackDirectories] = useState<{ id: string; name: string }[]>([]);

  const form = useForm<TCreateWorkspaceForm>({
    resolver: zodResolver(ZCreateWorkspaceForm),
    defaultValues: {
      name: "",
      teamIds: [],
      feedbackDirectoryId: undefined,
    },
  });
  const { getValues, setValue } = form;

  useEffect(() => {
    if (!open) return;

    const fetchModalData = async () => {
      const [teamsResponse, directoriesResponse] = await Promise.all([
        getTeamsByOrganizationIdAction({ organizationId }),
        getFeedbackDirectoriesByOrganizationIdAction({ organizationId }),
      ]);

      if (teamsResponse?.data) {
        setOrganizationTeams(teamsResponse.data);
      } else {
        const errorMessage = getFormattedErrorMessage(teamsResponse);
        toast.error(errorMessage);
      }

      if (directoriesResponse?.data) {
        setFeedbackDirectories(directoriesResponse.data);
        const selectedFeedbackDirectory = getValues("feedbackDirectoryId");
        const isSelectedDirectoryAvailable = directoriesResponse.data.some(
          (directory) => directory.id === selectedFeedbackDirectory
        );

        if (directoriesResponse.data.length === 0) {
          setValue("feedbackDirectoryId", undefined);
        } else if (!selectedFeedbackDirectory || !isSelectedDirectoryAvailable) {
          setValue("feedbackDirectoryId", directoriesResponse.data[0].id);
        }
      } else {
        const errorMessage = getFormattedErrorMessage(directoriesResponse);
        toast.error(errorMessage);
      }
    };
    fetchModalData();
  }, [open, organizationId, getValues, setValue]);

  const { isSubmitting } = form.formState;

  const organizationTeamsOptions = organizationTeams.map((team) => ({
    label: team.name,
    value: team.id,
  }));

  const onSubmit = async (data: TCreateWorkspaceForm) => {
    const createWorkspaceResponse = await createWorkspaceAction({
      organizationId,
      data: {
        name: data.name,
        teamIds: data.teamIds || [],
        feedbackDirectoryId: data.feedbackDirectoryId,
      },
    });

    if (createWorkspaceResponse?.data) {
      const workspace = createWorkspaceResponse.data;
      toast.success(t("common.workspace_created_successfully"));
      setOpen(false);
      form.reset();
      // Redirect to the new workspace's surveys page
      router.push(`/workspaces/${workspace.id}/surveys`);
    } else {
      const errorMessage = getFormattedErrorMessage(createWorkspaceResponse);
      toast.error(errorMessage);
    }
  };

  const handleClose = () => {
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent unconstrained={true}>
        <DialogHeader>
          <DialogTitle>{t("common.create_workspace")}</DialogTitle>
          <DialogDescription>{t("common.workspace_creation_description")}</DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogBody className="relative z-20 space-y-4 overflow-visible">
              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("common.workspace_name")}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t("common.workspace_name_placeholder")} autoFocus />
                    </FormControl>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="feedbackDirectoryId"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("workspace.unify.feedback_directory")}</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        disabled={feedbackDirectories.length === 0}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              feedbackDirectories.length > 0
                                ? t("workspace.unify.select_feedback_directory")
                                : t("workspace.unify.no_feedback_directory_available")
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {feedbackDirectories.map((directory) => (
                            <SelectItem key={directory.id} value={directory.id}>
                              {directory.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />

              {isAccessControlAllowed && organizationTeams.length > 0 && (
                <FormField
                  control={form.control}
                  name="teamIds"
                  render={({ field, fieldState: { error } }) => (
                    <FormItem>
                      <FormLabel>{t("common.team")}</FormLabel>
                      <FormControl>
                        <MultiSelect
                          value={field.value || []}
                          options={organizationTeamsOptions}
                          onChange={(teamIds) => field.onChange(teamIds)}
                          placeholder={t("common.select_teams")}
                        />
                      </FormControl>
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </FormItem>
                  )}
                />
              )}
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {t("common.create_workspace")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
