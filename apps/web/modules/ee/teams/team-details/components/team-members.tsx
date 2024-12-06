"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { removeTeamMemberAction, updateUserTeamRoleAction } from "@/modules/ee/teams/team-details/actions";
import { AddTeamMemberModal } from "@/modules/ee/teams/team-details/components/add-team-member-modal";
import { TOrganizationMember, TTeamMember } from "@/modules/ee/teams/team-details/types/teams";
import { TTeamRole, ZTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { TeamRoleMapping, getTeamAccessFlags } from "@/modules/ee/teams/utils/teams";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { Button } from "@/modules/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/ui/components/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";
import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";

interface TeamMembersProps {
  members: TTeamMember[];
  currentUserId: string;
  teamId: string;
  organizationMembers: TOrganizationMember[];
  membershipRole?: TOrganizationRole;
  teamRole: TTeamRole | null;
}

export const TeamMembers = ({
  members,
  currentUserId,
  teamId,
  organizationMembers,
  membershipRole,
  teamRole,
}: TeamMembersProps) => {
  const [openAddMemberModal, setOpenAddMemberModal] = useState<boolean>(false);
  const [removeMemberModalOpen, setRemoveMemberModalOpen] = useState<boolean>(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string | null>(null);

  const router = useRouter();
  const t = useTranslations();
  const { isOwner, isManager } = getAccessFlags(membershipRole);
  const { isAdmin: isTeamAdmin } = getTeamAccessFlags(teamRole);

  const isOwnerOrManager = isOwner || isManager;

  const canPerformRoleManagement = isOwnerOrManager || isTeamAdmin;

  const handleRoleChange = async (userId: string, role: TTeamRole) => {
    const updateAccessPermissionActionResponse = await updateUserTeamRoleAction({
      teamId,
      userId,
      role,
    });
    if (updateAccessPermissionActionResponse?.data) {
      toast.success(t("environments.settings.teams.role_updated_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updateAccessPermissionActionResponse);
      toast.error(errorMessage);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const removeMemberActionResponse = await removeTeamMemberAction({ teamId, userId });

    if (removeMemberActionResponse?.data) {
      toast.success(t("environments.settings.teams.member_removed_successfully"));
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(removeMemberActionResponse);
      toast.error(errorMessage);
    }

    setRemoveMemberModalOpen(false);
  };

  const organizationMemberOptions = useMemo(
    () =>
      organizationMembers
        .filter((member) => !members.find((teamMember) => teamMember.id === member.id))
        .map((member) => ({
          label: member.name,
          value: member.id,
        })),
    [members, organizationMembers]
  );

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("environments.settings.teams.team_members")}</CardTitle>
          <div className="flex gap-2">
            {isOwnerOrManager && (
              <Button variant="secondary" size="sm" asChild>
                <Link href="../general">{t("environments.settings.teams.invite_member")}</Link>
              </Button>
            )}
            {canPerformRoleManagement && (
              <Button size="sm" onClick={() => setOpenAddMemberModal(true)}>
                {t("environments.settings.teams.add_member")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>{t("common.member")}</TableHead>
                  <TableHead>{t("common.role")}</TableHead>
                  {canPerformRoleManagement && <TableHead>{t("common.actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      {t("environments.settings.teams.no_members_found")}
                    </TableCell>
                  </TableRow>
                )}
                {members.map((teamMember) => (
                  <TableRow key={teamMember.id}>
                    <TableCell>
                      <div>
                        <div className="font-semibold">{teamMember.name}</div>
                        <div className="text-sm text-gray-500">{teamMember.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canPerformRoleManagement &&
                      teamMember.isRoleEditable &&
                      currentUserId !== teamMember.id ? (
                        <Select
                          disabled={!teamMember.isRoleEditable}
                          value={teamMember.role}
                          onValueChange={(val: TTeamRole) => {
                            handleRoleChange(teamMember.id, val);
                          }}>
                          <SelectTrigger className="w-40">
                            <SelectValue
                              placeholder={t("environments.settings.teams.select_type")}
                              className="text-sm"
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ZTeamRole.Enum.admin}>
                              {t("environments.settings.teams.team_admin")}
                            </SelectItem>
                            <SelectItem value={ZTeamRole.Enum.contributor}>
                              {t("environments.settings.teams.contributor")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : canPerformRoleManagement && currentUserId !== teamMember.id ? (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-2">
                              <p>{TeamRoleMapping[teamMember.role]}</p>
                              <InfoIcon className="h-4 w-4 text-gray-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("environments.settings.teams.org_owner_and_managers_can_only_be_team_admin")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <p>{TeamRoleMapping[teamMember.role]}</p>
                      )}
                    </TableCell>
                    {canPerformRoleManagement && (
                      <TableCell>
                        {(teamMember.id !== currentUserId ||
                          (teamMember.id === currentUserId && isOwnerOrManager)) && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedTeamMemberId(teamMember.id);
                              setRemoveMemberModalOpen(true);
                            }}>
                            {teamMember.id === currentUserId
                              ? t("environments.settings.teams.leave")
                              : t("common.remove")}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {openAddMemberModal && (
        <AddTeamMemberModal
          teamId={teamId}
          open={openAddMemberModal}
          setOpen={setOpenAddMemberModal}
          organizationMemberOptions={organizationMemberOptions}
        />
      )}
      {removeMemberModalOpen && selectedTeamMemberId && (
        <AlertDialog
          open={removeMemberModalOpen}
          setOpen={setRemoveMemberModalOpen}
          headerText={t("environments.settings.teams.leave_team")}
          mainText={
            currentUserId === selectedTeamMemberId
              ? t("environments.settings.teams.leave_team_confirmation")
              : t("environments.settings.teams.remove_member_confirmation")
          }
          confirmBtnLabel={t("common.confirm")}
          onDecline={() => {
            setSelectedTeamMemberId(null);
            setRemoveMemberModalOpen(false);
          }}
          onConfirm={() => handleRemoveMember(selectedTeamMemberId)}
        />
      )}
    </>
  );
};
