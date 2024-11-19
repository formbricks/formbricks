"use client";

import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { AccessTable } from "@/modules/ee/teams/product-teams/components/access-table";
import { AddTeam } from "@/modules/ee/teams/product-teams/components/add-team";
import { TOrganizationTeam, TProductTeam } from "@/modules/ee/teams/product-teams/types/teams";
import { useTranslations } from "next-intl";
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
  const t = useTranslations();
  return (
    <>
      <SettingsCard
        title={t("common.teams")}
        description={t("environments.product.teams.team_settings_description")}>
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
