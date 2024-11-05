"use client";

import { TeamMembers } from "@/modules/ee/teams/team-details/components/team-members";
import { TeamProducts } from "@/modules/ee/teams/team-details/components/team-products";
import { TeamSettings } from "@/modules/ee/teams/team-details/components/team-settings";
import {
  TOrganizationMember,
  TOrganizationProduct,
  TTeam,
  TTeamProduct,
} from "@/modules/ee/teams/team-details/types/teams";
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
  teamRole: TTeamRole | null;
  products: TTeamProduct[];
  organizationProducts: TOrganizationProduct[];
}

export const DetailsView = ({
  team,
  userId,
  membershipRole,
  organizationMembers,
  teamRole,
  products,
  organizationProducts,
}: DetailsViewProps) => {
  const [activeId, setActiveId] = useState<"members" | "settings" | "products">("members");

  const navigation = [
    {
      id: "members",
      label: "Members",
      onClick: () => setActiveId("members"),
    },
    {
      id: "products",
      label: "Products",
      onClick: () => setActiveId("products"),
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
      {activeId === "products" && (
        <TeamProducts
          organizationProducts={organizationProducts}
          membershipRole={membershipRole}
          products={products}
          teamId={team.id}
        />
      )}
      {activeId === "settings" && <TeamSettings team={team} membershipRole={membershipRole} />}
    </div>
  );
};
