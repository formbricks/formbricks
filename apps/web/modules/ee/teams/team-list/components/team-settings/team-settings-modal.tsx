"use client";

import { cn } from "@/lib/cn";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { updateTeamDetailsAction } from "@/modules/ee/teams/team-list/actions";
import { DeleteTeam } from "@/modules/ee/teams/team-list/components/team-settings/delete-team";
import { TOrganizationProject } from "@/modules/ee/teams/team-list/types/project";
import {
  TOrganizationMember,
  TTeamDetails,
  TTeamRole,
  TTeamSettingsFormSchema,
  ZTeamRole,
  ZTeamSettingsFormSchema,
} from "@/modules/ee/teams/team-list/types/team";
import { getTeamAccessFlags } from "@/modules/ee/teams/utils/teams";
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
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { H4, Muted } from "@/modules/ui/components/typography";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslate } from "@tolgee/react";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { FormProvider, SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TeamSettingsModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  team: TTeamDetails;
  orgMembers: TOrganizationMember[];
  orgProjects: TOrganizationProject[];
  membershipRole?: TOrganizationRole;
  userTeamRole: TTeamRole | undefined;
  currentUserId: string;
}

export const TeamSettingsModal = ({
  open,
  setOpen,
  team,
  orgMembers,
  orgProjects,
  userTeamRole,
  membershipRole,
  currentUserId,
}: TeamSettingsModalProps) => {
  const { t } = useTranslate();

  const { isOwner, isManager, isMember } = getAccessFlags(membershipRole);

  const isOwnerOrManager = isOwner || isManager;

  const { isAdmin, isContributor } = getTeamAccessFlags(userTeamRole);

  const isTeamAdminMember = isMember && isAdmin;
  const isTeamContributorMember = isMember && isContributor;

  const router = useRouter();

  const initialMembers = useMemo(() => {
    const members = team.members.map((member) => ({
      userId: member.userId,
      role: member.role,
    }));

    return members.length ? members : [{ userId: "", role: ZTeamRole.enum.contributor }];
  }, [team.members]);

  const initialProjects = useMemo(() => {
    const projects = team.projects.map((project) => ({
      projectId: project.projectId,
      permission: project.permission,
    }));
    return projects.length ? projects : [{ projectId: "", permission: ZTeamPermission.enum.read }];
  }, [team.projects]);

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
    watch,
  } = form;

  const closeSettingsModal = () => {
    setOpen(false);
  };

  const handleUpdateTeam: SubmitHandler<TTeamSettingsFormSchema> = async (data) => {
    const members = data.members.filter((m) => m.userId);
    const projects = data.projects.filter((p) => p.projectId);

    const updatedTeamActionResponse = await updateTeamDetailsAction({
      teamId: team.id,
      data: {
        name: data.name,
        members,
        projects,
      },
    });

    if (updatedTeamActionResponse?.data) {
      toast.success(t("environments.settings.teams.team_updated_successfully"));
      closeSettingsModal();
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updatedTeamActionResponse);
      toast.error(errorMessage);
    }
  };

  const watchMembers = watch("members");
  const watchProjects = useWatch({ control, name: "projects" }) || [];

  const handleAddMember = () => {
    const newMembers = [...watchMembers, { userId: "", role: ZTeamRole.enum.contributor }];
    setValue("members", newMembers);
  };

  const handleRemoveMember = (index: number) => {
    setValue(
      "members",
      watchMembers.filter((_, i) => i !== index)
    );
  };

  const handleAddProject = () => {
    const newProjects = [...watchProjects, { projectId: "", permission: ZTeamPermission.enum.read }];
    setValue("projects", newProjects);
  };

  const handleRemoveProject = (index: number) => {
    setValue(
      "projects",
      watchProjects.filter((_, i) => i !== index)
    );
  };

  const selectedMemberIds = watchMembers.map((m) => m.userId);

  const selectedProjectIds = watchProjects.map((p) => p.projectId);

  const getMemberOptionsForIndex = (index: number) => {
    const currentMemberId = watchMembers[index]?.userId;
    return orgMembers
      .filter((om) => !selectedMemberIds.includes(om?.id) || om?.id === currentMemberId)
      .map((om) => ({ label: om?.name, value: om?.id }));
  };

  const getProjectOptionsForIndex = (index: number) => {
    const currentProjectId = watchProjects[index]?.projectId;
    return orgProjects
      .filter((op) => !selectedProjectIds.includes(op?.id) || op?.id === currentProjectId)
      .map((op) => ({ label: op?.name, value: op?.id }));
  };

  const handleMemberSelectionChange = (index: number, userId: string) => {
    setValue(`members.${index}.userId`, userId);
    const chosenMember = orgMembers.find((m) => m.id === userId);
    if (chosenMember) {
      if (chosenMember.role === "owner" || chosenMember.role === "manager") {
        setValue(`members.${index}.role`, "admin");
      } else {
        setValue(`members.${index}.role`, "contributor");
      }
    }
  };

  const hasEmptyMember = watchMembers.some((m) => !m.userId);

  const hasEmptyProject = watchProjects.some((p) => !p.projectId);

  return (
    <Modal
      open={open}
      setOpen={setOpen}
      noPadding
      className="flex max-h-[90dvh] flex-col overflow-visible" // Changed from "overflow-visible max-h-[90dvh]"
      size="md"
      hideCloseButton
      closeOnOutsideClick={true}>
      <div className="sticky top-0 z-10 rounded-t-lg bg-slate-100">
        <button
          className={cn(
            "absolute right-0 top-0 hidden pr-4 pt-4 text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-0 sm:block"
          )}
          onClick={closeSettingsModal}>
          <XIcon className="h-6 w-6 rounded-md bg-white" />
          <span className="sr-only">Close</span>
        </button>
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
      <FormProvider {...form}>
        <form
          className="flex w-full flex-grow flex-col overflow-hidden"
          onSubmit={handleSubmit(handleUpdateTeam)}>
          <div className="flex-grow space-y-6 overflow-y-auto p-6">
            <div className="space-y-6">
              <FormField
                control={control}
                name="name"
                render={({ field, fieldState: { error } }) => (
                  <FormItem>
                    <FormLabel>{t("common.team_name")}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder={t("common.team_name")}
                        {...field}
                        disabled={!isOwnerOrManager && !isTeamAdminMember}
                      />
                    </FormControl>
                    {error?.message && <FormError className="text-left">{error.message}</FormError>}
                  </FormItem>
                )}
              />

              {/* Members Section */}
              <div className="space-y-2">
                <FormLabel>{t("common.members")}</FormLabel>
                <FormField
                  control={control}
                  name={`members`}
                  render={({ fieldState: { error } }) => (
                    <FormItem className="flex-1">
                      <div className="max-h-40 space-y-2 overflow-y-auto p-1">
                        {watchMembers.map((member, index) => {
                          const memberOpts = getMemberOptionsForIndex(index);
                          return (
                            <div key={`member-${member.userId}-${index}`} className="flex gap-2.5">
                              <FormField
                                control={control}
                                name={`members.${index}.userId`}
                                render={({ field, fieldState: { error } }) => (
                                  <FormItem className="flex-1">
                                    <Select
                                      onValueChange={(val) => {
                                        field.onChange(val);
                                        handleMemberSelectionChange(index, val);
                                      }}
                                      disabled={!isOwnerOrManager && !isTeamAdminMember}
                                      value={member.userId}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select member" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {memberOpts.map((option) => (
                                          <SelectItem
                                            key={option.value}
                                            value={option.value}
                                            id={`member-${index}-option`}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {error?.message && (
                                      <FormError className="text-left">{error.message}</FormError>
                                    )}
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
                                      value={member.role}
                                      disabled={(() => {
                                        const chosenMember = orgMembers.find(
                                          (m) => m.id === watchMembers[index]?.userId
                                        );
                                        if (!chosenMember) return !isOwnerOrManager && !isTeamAdminMember;

                                        return (
                                          chosenMember.role === "owner" ||
                                          chosenMember.role === "manager" ||
                                          isTeamContributorMember ||
                                          chosenMember.id === currentUserId
                                        );
                                      })()}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={ZTeamRole.enum.admin}>
                                          {t("environments.settings.teams.team_admin")}
                                        </SelectItem>
                                        <SelectItem value={ZTeamRole.enum.contributor}>
                                          {t("environments.settings.teams.contributor")}
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />

                              {/* Delete Button for Member */}
                              {watchMembers.length > 1 && (
                                <Button
                                  size="icon"
                                  type="button"
                                  variant="secondary"
                                  className="shrink-0"
                                  disabled={
                                    !isOwnerOrManager &&
                                    (!isTeamAdminMember || member.userId === currentUserId)
                                  }
                                  onClick={() => handleRemoveMember(index)}>
                                  <Trash2Icon className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {error?.root?.message && (
                        <FormError className="text-left">{error.root.message}</FormError>
                      )}
                    </FormItem>
                  )}
                />
                <TooltipRenderer
                  shouldRender={selectedMemberIds.length === orgMembers.length || hasEmptyMember}
                  tooltipContent={
                    hasEmptyMember
                      ? t("environments.settings.teams.please_fill_all_member_fields")
                      : t("environments.settings.teams.all_members_added")
                  }>
                  <Button
                    size="default"
                    type="button"
                    variant="secondary"
                    onClick={handleAddMember}
                    disabled={
                      (!isOwnerOrManager && !isTeamAdminMember) ||
                      selectedMemberIds.length === orgMembers.length ||
                      hasEmptyMember
                    }>
                    <PlusIcon className="h-4 w-4" />
                    <span>Add member</span>
                  </Button>
                </TooltipRenderer>
                <Muted className="block text-slate-500">
                  {t("environments.settings.teams.add_members_description")}
                </Muted>
              </div>

              {/* Projects Section */}
              <div className="space-y-2">
                <FormLabel>Projects</FormLabel>
                <FormField
                  control={control}
                  name={`projects`}
                  render={({ fieldState: { error } }) => (
                    <FormItem className="flex-1">
                      <div className="max-h-40 space-y-2 overflow-y-auto p-1">
                        {watchProjects.map((project, index) => {
                          const projectOpts = getProjectOptionsForIndex(index);
                          return (
                            <div key={`project-${project.projectId}-${index}`} className="flex gap-2.5">
                              <FormField
                                control={control}
                                name={`projects.${index}.projectId`}
                                render={({ field, fieldState: { error } }) => (
                                  <FormItem className="flex-1">
                                    <Select
                                      onValueChange={field.onChange}
                                      value={project.projectId}
                                      disabled={!isOwnerOrManager}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select project" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {projectOpts.map((option) => (
                                          <SelectItem
                                            key={option.value}
                                            value={option.value}
                                            id={`project-${index}-option`}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {error?.message && (
                                      <FormError className="text-left">{error.message}</FormError>
                                    )}
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={control}
                                name={`projects.${index}.permission`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <Select
                                      onValueChange={field.onChange}
                                      value={project.permission}
                                      disabled={!isOwnerOrManager}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select project role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={ZTeamPermission.enum.read}>
                                          {t("environments.settings.teams.read")}
                                        </SelectItem>
                                        <SelectItem value={ZTeamPermission.enum.readWrite}>
                                          {t("environments.settings.teams.read_write")}
                                        </SelectItem>
                                        <SelectItem value={ZTeamPermission.enum.manage}>
                                          {t("environments.settings.teams.manage")}
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                              {watchProjects.length > 1 && (
                                <Button
                                  size="icon"
                                  type="button"
                                  variant="secondary"
                                  className="shrink-0"
                                  disabled={!isOwnerOrManager}
                                  onClick={() => handleRemoveProject(index)}>
                                  <Trash2Icon className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {error?.root?.message && (
                        <FormError className="text-left">{error.root.message}</FormError>
                      )}
                    </FormItem>
                  )}
                />

                <TooltipRenderer
                  shouldRender={selectedProjectIds.length === orgProjects.length || hasEmptyProject}
                  tooltipContent={
                    hasEmptyProject
                      ? t("environments.settings.teams.please_fill_all_project_fields")
                      : t("environments.settings.teams.all_projects_added")
                  }>
                  <Button
                    size="default"
                    type="button"
                    variant="secondary"
                    onClick={handleAddProject}
                    disabled={
                      !isOwnerOrManager || selectedProjectIds.length === orgProjects.length || hasEmptyProject
                    }>
                    <PlusIcon className="h-4 w-4" />
                    <span>Add project</span>
                  </Button>
                </TooltipRenderer>

                <Muted className="block text-slate-500">
                  {t("environments.settings.teams.add_projects_description")}
                </Muted>
              </div>

              <div className="w-max">
                <DeleteTeam
                  teamId={team.id}
                  onDelete={closeSettingsModal}
                  isOwnerOrManager={isOwnerOrManager}
                />
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 z-10 border-slate-200 p-6">
            <div className="flex justify-between">
              <Button size="default" type="button" variant="outline" onClick={closeSettingsModal}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                size="default"
                loading={isSubmitting}
                disabled={!isOwnerOrManager && !isTeamAdminMember}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </Modal>
  );
};
