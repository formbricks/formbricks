"use client";

import { AccessTable } from "@/modules/ee/teams/team-access/components/access-table";
import { AddTeam } from "@/modules/ee/teams/team-access/components/add-team";
import { TOrganizationTeam, TProductTeam } from "@/modules/ee/teams/team-access/types/teams";
import { TProduct } from "@formbricks/types/product";
import { H2, P } from "@formbricks/ui/components/Typography";

interface AccessViewProps {
  product: TProduct;
  teams: TProductTeam[];
  environmentId: string;
  organizationTeams: TOrganizationTeam[];
}

export const AccessView = ({ product, teams, organizationTeams, environmentId }: AccessViewProps) => {
  return (
    <div>
      <div className="flex">
        <H2 className="border-none">Product teams for {product.name}</H2>
        <AddTeam organizationTeams={organizationTeams} productTeams={teams} productId={product.id} />
      </div>
      <P>
        These teams and their members have access to this product. They can access surveys of this product
      </P>
      <P>Organization Owners and managers can grant access to this </P>
      <div className="mt-2">
        <AccessTable teams={teams} productId={product.id} environmentId={environmentId} />
      </div>
    </div>
  );
};
