"use client";

import { TeamMembers } from "@/modules/ee/teams/team-details/components/team-members";
import { TeamProjects } from "@/modules/ee/teams/team-details/components/team-projects";
import { TeamSettings } from "@/modules/ee/teams/team-details/components/team-settings";
import {
  TOrganizationMember,
  TOrganizationProject,
  TTeam,
  TTeamProject,
} from "@/modules/ee/teams/team-details/types/teams";
import { TTeamRole } from "@/modules/ee/teams/team-list/types/teams";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { SecondaryNavigation } from "@formbricks/ui/components/SecondaryNavigation";
import { H3 } from "@formbricks/ui/components/Typography";

interface DetailsViewProps {
  team: TTeam;
  userId: string;
  membershipRole?: TOrganizationRole;
  organizationMembers: TOrganizationMember[];
  teamRole: TTeamRole | null;
  projects: TTeamProject[];
  organizationProjects: TOrganizationProject[];
}

export const DetailsView = ({
  team,
  userId,
  membershipRole,
  organizationMembers,
  teamRole,
  projects,
  organizationProjects,
}: DetailsViewProps) => {
  const t = useTranslations();
  const [activeId, setActiveId] = useState<"members" | "settings" | "projects">("members");

  const navigation = [
    {
      id: "members",
      label: t("common.members"),
      onClick: () => setActiveId("members"),
    },
    {
      id: "projects",
      label: t("common.products"),
      onClick: () => setActiveId("projects"),
    },
    {
      id: "settings",
      label: t("common.settings"),
      onClick: () => setActiveId("settings"),
    },
  ];

  return (
    <div>
      <H3>{team.name}</H3>

      <div className="mt-2 border-b">
        <SecondaryNavigation navigation={navigation} activeId={activeId} />
      </div>
      {activeId === "members" && (
        <TeamMembers
          members={team.teamUsers}
          currentUserId={userId}
          teamId={team.id}
          organizationMembers={organizationMembers}
          membershipRole={membershipRole}
          teamRole={teamRole}
        />
      )}
      {activeId === "projects" && (
        <TeamProjects
          organizationProjects={organizationProjects}
          membershipRole={membershipRole}
          projects={projects}
          teamId={team.id}
        />
      )}
      {activeId === "settings" && <TeamSettings team={team} membershipRole={membershipRole} />}
    </div>
  );
};
