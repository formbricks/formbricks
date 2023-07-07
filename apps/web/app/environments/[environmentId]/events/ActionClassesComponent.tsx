import ActionClassesTable from "@/app/environments/[environmentId]/events/ActionClassesTable";
import { getActionClasses } from "@formbricks/lib/services/action";
import ActionClassDataRow from "@/app/environments/[environmentId]/events/RowData";
import TableHeading from "@/app/environments/[environmentId]/events/TableHeading";

export default async function ActionClassesComponent({ environmentId }: { environmentId: string }) {
  let actionClasses = await getActionClasses(environmentId);
  return (
    <>
      <ActionClassesTable environmentId={environmentId} actionClasses={actionClasses}>
        <TableHeading />
        {actionClasses.map((actionClass) => (
          <ActionClassDataRow key={actionClass.id} actionClass={actionClass} />
        ))}
      </ActionClassesTable>
    </>
  );
}
