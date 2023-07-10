import AttributeClassesTable from "@/app/environments/[environmentId]/attributes/AttributeClassesTable";
import HowToAddAttributesButton from "@/app/environments/[environmentId]/attributes/HowToAddAttributesButton";
import AttributeClassDataRow from "@/app/environments/[environmentId]/attributes/RowData";
import TableHeading from "@/app/environments/[environmentId]/attributes/TableHeading";
import { getAttributeClasses } from "@formbricks/lib/services/attribute";

export default async function AttributeClassesComponent({ environmentId }: { environmentId: string }) {
  let attributeClasses = await getAttributeClasses(environmentId);
  return (
    <>
      <AttributeClassesTable environmentId={environmentId} attributeClasses={attributeClasses}>
        <TableHeading />
        <HowToAddAttributesButton />

        {attributeClasses.map((attributeClass) => (
          <AttributeClassDataRow key={attributeClass.id} attributeClass={attributeClass} />
        ))}
      </AttributeClassesTable>
    </>
  );
}
