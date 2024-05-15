import { ActionClassesTable } from "@/app/(app)/environments/[environmentId]/actions/components/ActionClassesTable";
import { ActionClassDataRow } from "@/app/(app)/environments/[environmentId]/actions/components/ActionRowData";
import { ActionTableHeading } from "@/app/(app)/environments/[environmentId]/actions/components/ActionTableHeading";
import { AddActionModal } from "@/app/(app)/environments/[environmentId]/actions/components/AddActionModal";
import { Metadata } from "next";

import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

export const metadata: Metadata = {
  title: "Actions",
};

const Page = async ({ params }) => {
  const [actionClasses, team] = await Promise.all([
    getActionClasses(params.environmentId),
    getTeamByEnvironmentId(params.environmentId),
  ]);

  if (!team) {
    throw new Error("Team not found");
  }

  // On Formbricks Cloud only render the timeline if the user targeting feature is booked
  const isUserTargetingEnabled = IS_FORMBRICKS_CLOUD
    ? team.billing.features.userTargeting.status === "active"
    : true;

  const renderAddActionButton = () => (
    <AddActionModal environmentId={params.environmentId} actionClasses={actionClasses} />
  );

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Actions" cta={renderAddActionButton()} />
      <ActionClassesTable
        environmentId={params.environmentId}
        actionClasses={actionClasses}
        isUserTargetingEnabled={isUserTargetingEnabled}>
        <ActionTableHeading />
        {actionClasses.map((actionClass) => (
          <ActionClassDataRow key={actionClass.id} actionClass={actionClass} />
        ))}
      </ActionClassesTable>
    </PageContentWrapper>
  );
};

export default Page;
