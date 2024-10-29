"use client";

import { removeTeamMemberAction, updateUserTeamRoleAction } from "@/modules/ee/teams/team-details/actions";
import { AddTeamMemberModal } from "@/modules/ee/teams/team-details/components/add-team-member-modal";
import { TOrganizationMember, TTeamMember } from "@/modules/ee/teams/team-details/types/teams";
import { TTeamRole, ZTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { TeamRoleMapping, getTeamAccessFlags } from "@/modules/ee/teams/utils/teams";
import { InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { AlertDialog } from "@formbricks/ui/components/AlertDialog";
import { Button } from "@formbricks/ui/components/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@formbricks/ui/components/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@formbricks/ui/components/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@formbricks/ui/components/Table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/components/Tooltip";

interface TeamMembersProps {
  members: TTeamMember[];
  userId: string;
  teamId: string;
  organizationMembers: TOrganizationMember[];
  membershipRole?: TOrganizationRole;
  teamRole?: TTeamRole;
}

export const TeamMembers = ({
  members,
  userId,
  teamId,
  organizationMembers,
  membershipRole,
  teamRole,
}: TeamMembersProps) => {
  const [openAddMemberModal, setOpenAddMemberModal] = useState<boolean>(false);
  const [removeMemberModalOpen, setRemoveMemberModalOpen] = useState<boolean>(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string | null>(null);

  const router = useRouter();

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
      toast.success("Role updated successfully");
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(updateAccessPermissionActionResponse);
      toast.error(errorMessage);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    const removeMemberActionResponse = await removeTeamMemberAction({
      teamId,
      userId,
    });
    if (removeMemberActionResponse?.data) {
      toast.success("Member removed successfully");
      router.refresh();
    } else {
      const errorMessage = getFormattedErrorMessage(removeMemberActionResponse);
      toast.error(errorMessage);
    }

    setRemoveMemberModalOpen(false);
  };

  const organizationMemberOptions = organizationMembers
    .filter((member) => !members.find((teamMember) => teamMember.id === member.id))
    .map((member) => ({
      label: member.name,
      value: member.id,
    }));

  return (
    <>
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Team members</CardTitle>
          <div className="flex gap-2">
            {isOwnerOrManager && (
              <Button variant="secondary" size="sm" href="../general">
                Invite Member
              </Button>
            )}
            {canPerformRoleManagement && (
              <Button variant="primary" size="sm" onClick={() => setOpenAddMemberModal(true)}>
                Add Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((teamMember) => (
                  <TableRow key={teamMember.id}>
                    <TableCell>
                      <div>
                        <div className="font-semibold">{teamMember.name}</div>
                        <div className="text-sm text-gray-500">{teamMember.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canPerformRoleManagement && teamMember.isRoleEditable ? (
                        <Select
                          disabled={!teamMember.isRoleEditable}
                          value={teamMember.role}
                          onValueChange={(val: TTeamRole) => {
                            handleRoleChange(teamMember.id, val);
                          }}>
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Select type" className="text-sm" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ZTeamRole.Enum.admin}>Admin</SelectItem>
                            <SelectItem value={ZTeamRole.Enum.contributor}>Contributor</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : canPerformRoleManagement ? (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger className="flex items-center gap-2">
                              <p>{TeamRoleMapping[teamMember.role]}</p>
                              <InfoIcon className="h-4 w-4 text-gray-500" />
                            </TooltipTrigger>
                            <TooltipContent>Org owner and managers can only be admin.</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <p>{TeamRoleMapping[teamMember.role]}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {(teamMember.id === userId || canPerformRoleManagement) && (
                        <Button
                          variant="warn"
                          size="sm"
                          onClick={() => {
                            setSelectedTeamMemberId(teamMember.id);
                            setRemoveMemberModalOpen(true);
                          }}>
                          {teamMember.id === userId ? "Leave" : "Remove"}
                        </Button>
                      )}
                    </TableCell>
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
          headerText="Leave Team"
          mainText="Are you sure you want to remove this member?"
          confirmBtnLabel="Confirm"
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
