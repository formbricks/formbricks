
import AttributeClassesTable from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(attributes)/AttributeClassesTable";
import AttributeClassDataRow from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(attributes)/AttributeRowData";
import AttributeTableHeading from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(attributes)/AttributeTableHeading";
import HowToAddAttributesButton from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(attributes)/HowToAddAttributesButton";
import { getAttributeClasses } from "@formbricks/lib/services/attribute";

export default async function AttributeClassesComponent({ environmentId }: { environmentId: string }) {
  let attributeClasses = await getAttributeClasses(environmentId);
  return (
    <>
      <AttributeClassesTable environmentId={environmentId} attributeClasses={attributeClasses}>
        <AttributeTableHeading />
        <HowToAddAttributesButton />

        {attributeClasses.map((attributeClass) => (
          <AttributeClassDataRow key={attributeClass.id} attributeClass={attributeClass} />
        ))}
      </AttributeClassesTable>
    </>
  );
}
