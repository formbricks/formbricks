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
  isOwnerOrManager: boolean;
}

export const AccessView = ({
  product,
  teams,
  organizationTeams,
  environmentId,
  isOwnerOrManager,
}: AccessViewProps) => {
  return (
    <>
      <SettingsCard
        title={`Teams`}
        description="Teams and their members can access this product and its surveys. Organization owners and managers can grant this access.">
        <div className="flex justify-end gap-2">
          {isOwnerOrManager && (
            <AddTeam
              organizationTeams={organizationTeams}
              productTeams={teams}
              productId={product.id}
              organizationId={product.organizationId}
            />
          )}
        </div>
        <div className="mt-2">
          <AccessTable
            teams={teams}
            productId={product.id}
            environmentId={environmentId}
            isOwnerOrManager={isOwnerOrManager}
          />
        </div>
      </SettingsCard>
    </>
  );
};
