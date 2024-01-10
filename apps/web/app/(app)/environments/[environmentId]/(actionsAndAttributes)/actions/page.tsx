import ActionClassesTable from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/components/ActionClassesTable";
import ActionClassDataRow from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/components/ActionRowData";
import ActionTableHeading from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/actions/components/ActionTableHeading";
import { Metadata } from "next";

import { getActionClasses } from "@formbricks/lib/actionClass/service";

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
