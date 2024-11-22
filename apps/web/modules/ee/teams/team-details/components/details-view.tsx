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
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";
import { H3 } from "@/modules/ui/components/typography";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { TOrganizationRole } from "@formbricks/types/memberships";

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
  const t = useTranslations();
  const [activeId, setActiveId] = useState<"members" | "settings" | "products">("members");

  const navigation = [
    {
      id: "members",
      label: t("common.members"),
      onClick: () => setActiveId("members"),
    },
    {
      id: "products",
      label: t("common.products"),
      onClick: () => setActiveId("products"),
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
