"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { AccessTable } from "@/modules/ee/teams/team-access/components/access-table";
import { AddTeam } from "@/modules/ee/teams/team-access/components/add-team";
import { TOrganizationTeam, TProductTeam } from "@/modules/ee/teams/team-access/types/teams";
import { TProduct } from "@formbricks/types/product";

interface AccessViewProps {
  product: TProduct;
  teams: TProductTeam[];
  environmentId: string;
  organizationTeams: TOrganizationTeam[];
}

export const AccessView = ({ product, teams, organizationTeams, environmentId }: AccessViewProps) => {
  return (
    <>
      <SettingsCard
        title={`Product teams for ${product.name}`}
        description="These teams and their members have access to this product. They can access surveys of this product. Organization Owners and managers can grant access to this">
        <div className="flex justify-end gap-2">
          <AddTeam
            organizationTeams={organizationTeams}
            productTeams={teams}
            productId={product.id}
            organizationId={product.organizationId}
          />
        </div>
        <div className="mt-2">
          <AccessTable teams={teams} productId={product.id} environmentId={environmentId} />
        </div>
      </SettingsCard>
    </>
  );
};
