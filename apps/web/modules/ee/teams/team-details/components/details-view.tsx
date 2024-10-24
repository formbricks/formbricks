"use client";

import { AddTeamMemberModal } from "@/modules/ee/teams/team-details/components/add-team-member-modal";
import { TeamMembers } from "@/modules/ee/teams/team-details/components/team-members";
import { TeamSettings } from "@/modules/ee/teams/team-details/components/team-settings";
import { TTeam } from "@/modules/ee/teams/team-details/types/teams";
import { useState } from "react";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { Button } from "@formbricks/ui/components/Button";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";
import { H3 } from "@formbricks/ui/components/Typography";

interface DetailsViewProps {
  team: TTeam;
  userId: string;
  membershipRole?: TOrganizationRole;
}

export const DetailsView = ({ team, userId, membershipRole }: DetailsViewProps) => {
  const [activeId, setActiveId] = useState<"members" | "settings">("members");
  const [openAddMemberModal, setOpenAddMemberModal] = useState<boolean>(false);

  const navigation = [
    {
      id: "members",
      label: "Members",
      onClick: () => setActiveId("members"),
    },
    {
      id: "settings",
      label: "Settings",
      onClick: () => setActiveId("settings"),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <H3>{team.name}</H3>
        <Button variant="primary" size="sm" onClick={() => setOpenAddMemberModal(true)}>
          Add Member
        </Button>
      </div>
      <div className="mt-2 border-b">
        <SecondaryNavigation navigation={navigation} activeId={activeId} />
      </div>
      {activeId === "members" ? (
        <TeamMembers members={team.teamMembers} userId={userId} />
      ) : (
        <TeamSettings team={team} membershipRole={membershipRole} />
      )}
      {openAddMemberModal && <AddTeamMemberModal open={openAddMemberModal} setOpen={setOpenAddMemberModal} />}
    </div>
  );
};
