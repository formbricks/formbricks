import ActionClassesTable from "@/app/(app)/environments/[environmentId]/actions/components/ActionClassesTable";
import ActionClassDataRow from "@/app/(app)/environments/[environmentId]/actions/components/ActionRowData";
import ActionTableHeading from "@/app/(app)/environments/[environmentId]/actions/components/ActionTableHeading";
import { Metadata } from "next";

import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

export const metadata: Metadata = {
  title: "Actions",
};

export default async function ActionClassesComponent({ params }) {
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

  return (
    <>
      <ActionClassesTable
        environmentId={params.environmentId}
        actionClasses={actionClasses}
        isUserTargetingEnabled={isUserTargetingEnabled}>
        <ActionTableHeading />
        {actionClasses.map((actionClass) => (
          <ActionClassDataRow key={actionClass.id} actionClass={actionClass} />
        ))}
      </ActionClassesTable>
    </>
  );
}
