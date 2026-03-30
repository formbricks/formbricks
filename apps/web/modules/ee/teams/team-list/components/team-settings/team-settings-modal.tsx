"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { FormProvider, SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { getAccessFlags } from "@/lib/membership/utils";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { ZTeamPermission } from "@/modules/ee/teams/project-teams/types/team";
import { updateTeamDetailsAction } from "@/modules/ee/teams/team-list/actions";
import { DeleteTeam } from "@/modules/ee/teams/team-list/components/team-settings/delete-team";
import { MemberRow } from "@/modules/ee/teams/team-list/components/team-settings/member-row";
import { WorkspaceRow } from "@/modules/ee/teams/team-list/components/team-settings/workspace-row";
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
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { Muted } from "@/modules/ui/components/typography";

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
  const { t } = useTranslation();

  const { isOwner, isManager, isMember } = getAccessFlags(membershipRole);

  const isOwnerOrManager = isOwner || isManager;

  const { isAdmin, isContributor } = getTeamAccessFlags(userTeamRole);

  const isTeamAdminMember = isMember && isAdmin;
  const isTeamContributorMember = isMember && isContributor;

  const router = useRouter();

  // Track initial member IDs to distinguish existing members from newly added ones
  const initialMemberIds = useMemo(() => {
    return new Set(team.members.map((member) => member.userId));
  }, [team.members]);

  // Track initial project IDs to distinguish existing projects from newly added ones
  const initialProjectIds = useMemo(() => {
    return new Set(team.projects.map((project) => project.projectId));
  }, [team.projects]);

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
      .map((om) => ({ label: om?.name ?? "", value: om?.id }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  };

  const getProjectOptionsForIndex = (index: number) => {
    const currentProjectId = watchProjects[index]?.projectId;
    return orgProjects
      .filter((op) => !selectedProjectIds.includes(op?.id) || op?.id === currentProjectId)
      .map((op) => ({ label: op?.name ?? "", value: op?.id }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader className="pb-4">
          <DialogTitle>
            {t("environments.settings.teams.team_name_settings_title", {
              teamName: team.name,
            })}
          </DialogTitle>
          <DialogDescription>{t("environments.settings.teams.team_settings_description")}</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form className="contents space-y-4" onSubmit={handleSubmit(handleUpdateTeam)}>
            <DialogBody className="flex-grow space-y-6 overflow-y-auto">
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

              <IdBadge id={team.id} label={t("common.team_id")} variant="column" />

              {/* Members Section */}
              <div className="space-y-2">
                <div className="flex flex-col space-y-1">
                  <FormLabel>{t("common.members")}</FormLabel>
                  <Muted className="block text-slate-500">
                    {t("environments.settings.teams.add_members_description")}
                  </Muted>
                </div>
                <FormField
                  control={control}
                  name={`members`}
                  render={({ fieldState: { error } }) => (
                    <FormItem className="flex-1">
                      <div className="space-y-2 overflow-y-auto">
                        {watchMembers.map((member, index) => (
                          <MemberRow
                            key={`member-${member.userId}-${index}`}
                            index={index}
                            member={member}
                            memberOpts={getMemberOptionsForIndex(index)}
                            control={control}
                            orgMembers={orgMembers}
                            watchMembers={watchMembers}
                            initialMemberIds={initialMemberIds}
                            isOwnerOrManager={isOwnerOrManager}
                            isTeamAdminMember={isTeamAdminMember}
                            isTeamContributorMember={isTeamContributorMember}
                            currentUserId={currentUserId}
                            onMemberSelectionChange={handleMemberSelectionChange}
                            onRemoveMember={handleRemoveMember}
                            memberCount={watchMembers.length}
                          />
                        ))}
                      </div>
                      {error?.root?.message && (
                        <FormError className="text-left">{error.root.message}</FormError>
                      )}
                    </FormItem>
                  )}
                />
                <TooltipRenderer
                  shouldRender={selectedMemberIds.length === orgMembers.length || hasEmptyMember}
                  triggerClass="inline-block"
                  tooltipContent={
                    hasEmptyMember
                      ? t("environments.settings.teams.please_fill_all_member_fields")
                      : t("environments.settings.teams.all_members_added")
                  }>
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={handleAddMember}
                    disabled={
                      (!isOwnerOrManager && !isTeamAdminMember) ||
                      selectedMemberIds.length === orgMembers.length ||
                      hasEmptyMember
                    }>
                    <PlusIcon className="h-4 w-4" />
                    <span>{t("common.add_member")}</span>
                  </Button>
                </TooltipRenderer>
              </div>

              {/* Projects Section */}
              <div className="space-y-2">
                <div className="flex flex-col space-y-1">
                  <FormLabel>{t("common.workspaces")}</FormLabel>
                  <Muted className="block text-slate-500">
                    {t("environments.settings.teams.add_workspaces_description")}
                  </Muted>
                </div>
                <FormField
                  control={control}
                  name={`projects`}
                  render={({ fieldState: { error } }) => (
                    <FormItem className="flex-1">
                      <div className="space-y-2">
                        {watchProjects.map((project, index) => (
                          <WorkspaceRow
                            key={`workspace-${project.projectId}-${index}`}
                            index={index}
                            project={project}
                            projectOpts={getProjectOptionsForIndex(index)}
                            control={control}
                            initialProjectIds={initialProjectIds}
                            isOwnerOrManager={isOwnerOrManager}
                            onRemoveProject={handleRemoveProject}
                            projectCount={watchProjects.length}
                          />
                        ))}
                      </div>
                      {error?.root?.message && (
                        <FormError className="text-left">{error.root.message}</FormError>
                      )}
                    </FormItem>
                  )}
                />

                <TooltipRenderer
                  shouldRender={selectedProjectIds.length === orgProjects.length || hasEmptyProject}
                  triggerClass="inline-block"
                  tooltipContent={
                    hasEmptyProject
                      ? t("environments.settings.teams.please_fill_all_workspace_fields")
                      : t("environments.settings.teams.all_workspaces_added")
                  }>
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={handleAddProject}
                    disabled={
                      !isOwnerOrManager || selectedProjectIds.length === orgProjects.length || hasEmptyProject
                    }>
                    <PlusIcon className="h-4 w-4" />
                    {t("common.add_workspace")}
                  </Button>
                </TooltipRenderer>
              </div>
            </DialogBody>
            <DialogFooter>
              <div className="w-full">
                <DeleteTeam
                  teamId={team.id}
                  onDelete={closeSettingsModal}
                  isOwnerOrManager={isOwnerOrManager}
                />
              </div>
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
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
