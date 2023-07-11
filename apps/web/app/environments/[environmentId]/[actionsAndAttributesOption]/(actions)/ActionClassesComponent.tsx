import ActionClassesTable from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(actions)/ActionClassesTable";
import ActionClassDataRow from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(actions)/ActionRowData";
import ActionTableHeading from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(actions)/ActionTableHeading";
import { getActionClasses } from "@formbricks/lib/services/action";

export default async function ActionClassesComponent({ environmentId }: { environmentId: string }) {
  let actionClasses = await getActionClasses(environmentId);
  return (
    <>
      <ActionClassesTable environmentId={environmentId} actionClasses={actionClasses}>
        <ActionTableHeading />
        {actionClasses.map((actionClass) => (
          <ActionClassDataRow key={actionClass.id} actionClass={actionClass} />
        ))}
      </ActionClassesTable>
    </>
  );
}
