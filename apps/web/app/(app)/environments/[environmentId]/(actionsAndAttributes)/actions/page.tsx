export const revalidate = REVALIDATION_INTERVAL;

import ActionClassesTable from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/ActionClassesTable";
import ActionClassDataRow from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/ActionRowData";
import ActionTableHeading from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/ActionTableHeading";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Actions",
};

export default async function ActionClassesComponent({ params }) {
  let actionClasses = await getActionClasses(params.environmentId);
  return (
    <>
      <ActionClassesTable environmentId={params.environmentId} actionClasses={actionClasses}>
        <ActionTableHeading />
        {actionClasses.map((actionClass) => (
          <ActionClassDataRow key={actionClass.id} actionClass={actionClass} />
        ))}
      </ActionClassesTable>
    </>
  );
}
