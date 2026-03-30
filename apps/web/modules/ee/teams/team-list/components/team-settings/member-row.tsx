"use client";

import { XIcon } from "lucide-react";
import { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  TOrganizationMember,
  TTeamRole,
  TTeamSettingsFormSchema,
  ZTeamRole,
} from "@/modules/ee/teams/team-list/types/team";
import { Button } from "@/modules/ui/components/button";
import { FormError, FormField, FormItem } from "@/modules/ui/components/form";
import { InputCombobox } from "@/modules/ui/components/input-combo-box";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

export interface MemberRowProps {
  index: number;
  member: { userId: string; role: TTeamRole };
  memberOpts: { value: string; label: string }[];
  control: Control<TTeamSettingsFormSchema>;
  orgMembers: TOrganizationMember[];
  watchMembers: { userId: string; role: TTeamRole }[];
  initialMemberIds: Set<string>;
  isOwnerOrManager: boolean;
  isTeamAdminMember: boolean;
  isTeamContributorMember: boolean;
  currentUserId: string;
  onMemberSelectionChange: (index: number, userId: string) => void;
  onRemoveMember: (index: number) => void;
  memberCount: number;
}

export function MemberRow(props: Readonly<MemberRowProps>) {
  const {
    index,
    member,
    memberOpts,
    control,
    orgMembers,
    watchMembers,
    initialMemberIds,
    isOwnerOrManager,
    isTeamAdminMember,
    isTeamContributorMember,
    currentUserId,
    onMemberSelectionChange,
    onRemoveMember,
    memberCount,
  } = props;
  const { t } = useTranslation();
  const chosenMember = orgMembers.find((m) => m.id === watchMembers[index]?.userId);
  const canEditWhenNoMember = isOwnerOrManager || isTeamAdminMember;
  const isRoleSelectDisabled =
    chosenMember === undefined
      ? !canEditWhenNoMember
      : chosenMember.role === "owner" ||
        chosenMember.role === "manager" ||
        isTeamContributorMember ||
        chosenMember.id === currentUserId;

  return (
    <div className="flex gap-2.5">
      <FormField
        control={control}
        name={`members.${index}.userId`}
        render={({ field, fieldState: { error } }) => {
          const isExistingMember = member.userId && initialMemberIds.has(member.userId);
          const isSelectDisabled = isExistingMember || (!isOwnerOrManager && !isTeamAdminMember);

          return (
            <FormItem className="flex-1">
              <div className={isSelectDisabled ? "pointer-events-none opacity-50" : undefined}>
                <InputCombobox
                  id={`member-select-${index}`}
                  options={memberOpts}
                  value={field.value || null}
                  onChangeValue={(val) => {
                    const value = typeof val === "string" ? val : "";
                    field.onChange(value);
                    onMemberSelectionChange(index, value);
                  }}
                  showSearch
                  searchPlaceholder={t("common.search")}
                  comboboxClasses="flex-1 min-w-0 w-full"
                  emptyDropdownText={t("environments.surveys.edit.no_option_found")}
                />
              </div>
              {error?.message && <FormError className="text-left">{error.message}</FormError>}
            </FormItem>
          );
        }}
      />
      <FormField
        control={control}
        name={`members.${index}.role`}
        render={({ field }) => {
          const roleOptions = [
            { value: ZTeamRole.enum.admin, label: t("environments.settings.teams.team_admin") },
            {
              value: ZTeamRole.enum.contributor,
              label: t("environments.settings.teams.contributor"),
            },
          ];

          return (
            <FormItem className="flex-1">
              <div className={isRoleSelectDisabled ? "pointer-events-none opacity-50" : undefined}>
                <InputCombobox
                  id={`member-role-select-${index}`}
                  options={roleOptions}
                  value={field.value}
                  onChangeValue={(val) => field.onChange(val)}
                  showSearch={false}
                  comboboxClasses="flex-1 min-w-0 w-full"
                />
              </div>
            </FormItem>
          );
        }}
      />
      {memberCount > 1 && (
        <TooltipRenderer tooltipContent={t("common.remove_from_team")}>
          <Button
            size="icon"
            type="button"
            variant="destructive"
            className="shrink-0"
            disabled={!isOwnerOrManager && (!isTeamAdminMember || member.userId === currentUserId)}
            onClick={() => onRemoveMember(index)}>
            <XIcon className="h-4 w-4" />
          </Button>
        </TooltipRenderer>
      )}
    </div>
  );
}
