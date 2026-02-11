"use client";

import { UsersRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TMember } from "@formbricks/types/memberships";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { addMemberToTeamAction } from "@/modules/ee/teams/team-list/actions";
import { TOrganizationTeam, ZTeamRole } from "@/modules/ee/teams/team-list/types/team";
import { Button } from "@/modules/ui/components/button";
import { FormControl, FormField, FormItem, FormLabel, FormProvider } from "@/modules/ui/components/form";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

type AssignToTeamFormValues = {
  teamId: string | null;
  role: "admin" | "contributor";
};

interface AssignToTeamPopoverProps {
  member: TMember;
  assignableTeams: TOrganizationTeam[];
  memberTeamIdsMap: Record<string, string[]>;
}

export const AssignToTeamPopover = ({
  member,
  assignableTeams,
  memberTeamIdsMap,
}: Readonly<AssignToTeamPopoverProps>) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [isAssigningToTeam, setIsAssigningToTeam] = useState(false);
  const [open, setOpen] = useState(false);

  const assignToTeamForm = useForm<AssignToTeamFormValues>({
    defaultValues: { teamId: null, role: "contributor" },
  });

  const memberTeamIds = memberTeamIdsMap[member.userId] ?? [];
  const teamsToAssign = assignableTeams.filter((team) => !memberTeamIds.includes(team.id));
  const canAssignToTeam = teamsToAssign.length > 0;
  const isOwnerOrManager = member.role === "owner" || member.role === "manager";

  const teamOptions = useMemo(
    () =>
      teamsToAssign
        .map((team) => ({ value: team.id, label: team.name }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    [teamsToAssign]
  );

  const roleOptions = useMemo(
    () => [
      { value: ZTeamRole.enum.admin, label: t("environments.settings.teams.team_admin") },
      { value: ZTeamRole.enum.contributor, label: t("environments.settings.teams.contributor") },
    ],
    [t]
  );

  const handleAssignToTeam = async (values: AssignToTeamFormValues) => {
    if (!values.teamId) return;
    try {
      setIsAssigningToTeam(true);
      const result = await addMemberToTeamAction({
        teamId: values.teamId,
        userId: member.userId,
        role: isOwnerOrManager ? "admin" : values.role,
      });
      if (result?.data) {
        toast.success(t("environments.settings.teams.member_added_to_team"));
        setOpen(false);
        assignToTeamForm.reset({ teamId: null, role: "contributor" });
        router.refresh();
      } else {
        const rawMessage = getFormattedErrorMessage(result);
        const errorMessage =
          rawMessage === "team_requires_workspace"
            ? t("environments.settings.teams.team_requires_workspace")
            : rawMessage;
        toast.error(errorMessage);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`${t("common.error")}: ${message}`);
    } finally {
      setIsAssigningToTeam(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      assignToTeamForm.reset({ teamId: null, role: "contributor" });
    }
  };

  const getTooltip = () => {
    if (canAssignToTeam) return t("common.add_to_team");
    if (assignableTeams.length === 0) {
      return t("environments.settings.teams.create_first_team_message");
    }
    return t("environments.settings.teams.member_in_all_teams");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <TooltipRenderer tooltipContent={getTooltip()} shouldRender>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            id="assignToTeamButton"
            disabled={isAssigningToTeam || !canAssignToTeam}>
            <UsersRoundIcon />
          </Button>
        </PopoverTrigger>
      </TooltipRenderer>
      <PopoverContent align="end" className="w-72">
        <FormProvider {...assignToTeamForm}>
          <form className="space-y-3" onSubmit={assignToTeamForm.handleSubmit(handleAssignToTeam)}>
            <FormField
              control={assignToTeamForm.control}
              name="teamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.team_name")}</FormLabel>
                  <FormControl>
                    <InputCombobox
                      id="assign-team-combobox"
                      options={teamOptions}
                      value={field.value}
                      onChangeValue={(val) => field.onChange(typeof val === "string" ? val : null)}
                      showSearch
                      searchPlaceholder={t("common.search")}
                      comboboxClasses="w-full text-sm"
                      emptyDropdownText={t("environments.surveys.edit.no_option_found")}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={assignToTeamForm.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.team_role")}</FormLabel>
                  {isOwnerOrManager ? (
                    <div className="flex h-10 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">
                      {t("environments.settings.teams.team_admin")}
                    </div>
                  ) : (
                    <FormControl>
                      <InputCombobox
                        id="assign-role-combobox"
                        options={roleOptions}
                        value={field.value}
                        onChangeValue={(val) => field.onChange(val as "admin" | "contributor")}
                        showSearch={false}
                        comboboxClasses="w-full text-sm"
                      />
                    </FormControl>
                  )}
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="sm"
              className="w-full"
              disabled={!assignToTeamForm.watch("teamId") || isAssigningToTeam}
              loading={isAssigningToTeam}>
              {t("common.add_to_team")}
            </Button>
          </form>
        </FormProvider>
      </PopoverContent>
    </Popover>
  );
};
