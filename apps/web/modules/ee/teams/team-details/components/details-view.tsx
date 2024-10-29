"use client";

import { TeamMembers } from "@/modules/ee/teams/team-details/components/team-members";
import { TeamSettings } from "@/modules/ee/teams/team-details/components/team-settings";
import { TOrganizationMember, TTeam } from "@/modules/ee/teams/team-details/types/teams";
import { TTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { useState } from "react";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";
import { H3 } from "@formbricks/ui/components/Typography";

interface DetailsViewProps {
  team: TTeam;
  userId: string;
  membershipRole?: TOrganizationRole;
  organizationMembers: TOrganizationMember[];
  teamRole?: TTeamRole;
}

export const DetailsView = ({
  team,
  userId,
  membershipRole,
  organizationMembers,
  teamRole,
}: DetailsViewProps) => {
  const [activeId, setActiveId] = useState<"members" | "settings">("members");

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
      <H3>{team.name}</H3>

      <div className="mt-2 border-b">
        <SecondaryNavigation navigation={navigation} activeId={activeId} />
      </div>
      {activeId === "members" ? (
        <TeamMembers
          members={team.teamMembers}
          userId={userId}
          teamId={team.id}
          organizationMembers={organizationMembers}
          membershipRole={membershipRole}
          teamRole={teamRole}
        />
      ) : (
        <TeamSettings team={team} membershipRole={membershipRole} />
      )}
    </div>
  );
};
