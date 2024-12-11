"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/teams";
import { updateTeamAction } from "@/modules/ee/teams/team-list/actions";
import { DeleteTeam } from "@/modules/ee/teams/team-list/components/team-settings/delete-team";
import { TOrganizationProject } from "@/modules/ee/teams/team-list/types/project";
import {
  TOrganizationMember,
  TTeamDetails,
  TTeamSettingsFormSchema,
  ZTeamRole,
  ZTeamSettingsFormSchema,
} from "@/modules/ee/teams/team-list/types/teams";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormError, FormField, FormItem, FormLabel } from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { Modal } from "@/modules/ui/components/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { H4, Muted } from "@/modules/ui/components/typography";
import { zodResolver } from "@hookform/resolvers/zod";
import { createId } from "@paralleldrive/cuid2";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { FormProvider, SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { cn } from "@formbricks/lib/cn";

interface TeamSettingsModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  team: TTeamDetails;
  orgMembers: TOrganizationMember[];
  orgProjects: TOrganizationProject[];
}

export const TeamSettingsModal = ({
  open,
  setOpen,
  team,
  orgMembers,
  orgProjects,
}: TeamSettingsModalProps) => {
  const t = useTranslations();

  const initialMembers = useMemo(
    () =>
      team.members.map((member) => ({
        id: member.userId,
        role: member.role,
      })),
    [team.members]
  );

  const initialProjects = useMemo(
    () =>
      team.projects.map((project) => ({
        id: project.projectId,
        permission: project.permission,
      })),
    [team.projects]
  );

  const form = useForm<TTeamSettingsFormSchema>({
    defaultValues: {
      name: team.name,
      members: initialMembers,
      projects: initialProjects,
    },
    mode: "onChange",
    resolver: zodResolver(ZTeamSettingsFormSchema),
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

  const handleUpdateTeam: SubmitHandler<TTeamSettingsFormSchema> = async (data) => {
    const updatedTeamActionResponse = await updateTeamAction({
      teamId: team.id,
      data: {
        name: data.name,
        members: data.members,
        projects: data.projects,
      },
    });

    if (updatedTeamActionResponse?.data) {
      toast.success(t("common.team_updated"));
      closeSettingsModal();
    } else {
      const errorMessage = getFormattedErrorMessage(updatedTeamActionResponse);
      toast.error(errorMessage);
    }
  };

  const watchMembers = useWatch({ control, name: "members" }) || [];
  const watchProjects = useWatch({ control, name: "projects" }) || [];

  const handleAddMember = () => {
    const newMembers = [...watchMembers, { id: "", role: "contributor" }];
    setValue("members", newMembers as any);
  };

  const handleRemoveMember = (index: number) => {
    const currentMembers = [...watchMembers];
    currentMembers.splice(index, 1);
    setValue("members", currentMembers);
  };

  const handleAddProject = () => {
    const newProjects = [...watchProjects, { id: "", permission: "read" }];
    setValue("projects", newProjects as any);
  };

  const handleRemoveProject = (index: number) => {
    const currentProjects = [...watchProjects];
    currentProjects.splice(index, 1);
    setValue("projects", currentProjects);
  };

  const selectedMemberIds = watchMembers.map((m) => m.id as string);

  const selectedProjectIds = watchProjects.map((p) => p.id as string);

  const getMemberOptionsForIndex = (index: number) => {
    const currentMemberId = watchMembers[index]?.id;
    return (
      orgMembers
        // .filter((om) => !selectedMemberIds.includes(om?.id) || om?.id === currentMemberId)
        .map((om) => ({ label: om?.name, value: om?.id }))
    );
  };

  const getProjectOptionsForIndex = (index: number) => {
    const currentProjectId = watchProjects[index]?.id;
    return (
      orgProjects
        // .filter((op) => !selectedProjectIds.includes(op?.id) || op?.id === currentProjectId)
        .map((op) => ({ label: op?.name, value: op?.id }))
    );
  };

  const handleMemberSelectionChange = (index: number, userId: string) => {
    setValue(`members.${index}.id`, userId);
    const chosenMember = orgMembers.find((m) => m.id === userId);
    if (chosenMember) {
      if (chosenMember.role === "owner" || chosenMember.role === "manager") {
        setValue(`members.${index}.role`, "admin");
      } else {
        setValue(`members.${index}.role`, "contributor");
      }
    }
  };

  console.log("watchMembers", watchMembers);
  return (
    <Modal open={open} setOpen={setOpen} noPadding className="overflow-visible" size="md" hideCloseButton>
      <div className="sticky top-0 flex h-full flex-col rounded-lg">
        <button
          className={cn(
            "absolute right-0 top-0 hidden pr-4 pt-4 text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-0 sm:block"
          )}
          onClick={closeSettingsModal}>
          <XIcon className="h-6 w-6 rounded-md bg-white" />
          <span className="sr-only">Close</span>
        </button>
        <div className="rounded-t-lg bg-slate-100">
          <div className="flex w-full items-center justify-between p-6">
            <div className="flex items-center space-x-2">
              <div>
                <H4>
                  {t("environments.settings.teams.team_name_settings_title", {
                    teamName: team.name,
                  })}
                </H4>
                <Muted className="text-slate-500">
                  {t("environments.settings.teams.team_settings_description")}
                </Muted>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FormProvider {...form}>
        <form className="w-full" onSubmit={handleSubmit(handleUpdateTeam)}>
          <div className="flex flex-col gap-6 p-6">
            <FormField
              control={control}
              name="name"
              render={({ field, fieldState: { error } }) => (
                <FormItem>
                  <FormLabel>Team name</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Team name" {...field} />
                  </FormControl>
                  {error?.message && <FormError className="text-left">{error.message}</FormError>}
                </FormItem>
              )}
            />

            {/* Members Section */}
            <div className="space-y-2">
              <FormLabel>{t("common.members")}</FormLabel>
              {watchMembers.map((member, index) => {
                const memberOpts = getMemberOptionsForIndex(index);
                return (
                  <div key={`member-${index}`} className="flex gap-2.5">
                    <FormField
                      control={control}
                      name={`members.${index}.id`}
                      render={({ field, fieldState: { error } }) => (
                        <FormItem className="flex-1">
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              handleMemberSelectionChange(index, val);
                            }}
                            value={field.value || ""}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select member" />
                            </SelectTrigger>
                            <SelectContent>
                              {memberOpts.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {error?.message && <FormError className="text-left">{error.message}</FormError>}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`members.${index}.role`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={(() => {
                              const chosenMember = orgMembers.find((m) => m.id === watchMembers[index]?.id);
                              return chosenMember
                                ? chosenMember.role === "owner" || chosenMember.role === "manager"
                                : false;
                            })()}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                {t("environments.settings.teams.team_admin")}
                              </SelectItem>
                              <SelectItem value="contributor">
                                {t("environments.settings.teams.contributor")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    {/* Delete Button for Member */}
                    <Button
                      size="icon"
                      type="button"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => handleRemoveMember(index)}>
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <Button size="default" type="button" variant="secondary" onClick={handleAddMember}>
                <PlusIcon className="h-4 w-4" />
                <span>Add member</span>
              </Button>
            </div>

            {/* Projects Section */}
            <div className="space-y-2">
              <FormLabel>Projects</FormLabel>
              {watchProjects.map((project, index) => {
                const projectOpts = getProjectOptionsForIndex(index);
                return (
                  <div key={`project-${index}`} className="flex gap-2.5">
                    <FormField
                      control={control}
                      name={`projects.${index}.id`}
                      render={({ field, fieldState: { error } }) => (
                        <FormItem className="flex-1">
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectOpts.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {error?.message && <FormError className="text-left">{error.message}</FormError>}
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`projects.${index}.permission`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select project role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="read">{t("environments.settings.teams.read")}</SelectItem>
                              <SelectItem value="readWrite">
                                {t("environments.settings.teams.read_write")}
                              </SelectItem>
                              <SelectItem value="manage">
                                {t("environments.settings.teams.manage")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <Button
                      size="icon"
                      type="button"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => handleRemoveProject(index)}>
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <Button size="default" type="button" variant="secondary" onClick={handleAddProject}>
                <PlusIcon className="h-4 w-4" />
                <span>Add project</span>
              </Button>
            </div>

            <DeleteTeam teamId={team.id} onDelete={closeSettingsModal} />
            <div className="flex justify-between">
              <Button size="default" type="button" variant="outline" onClick={closeSettingsModal}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="default" loading={isSubmitting}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
};
