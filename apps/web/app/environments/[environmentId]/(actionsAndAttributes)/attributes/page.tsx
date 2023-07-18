import AttributeClassesTable from "@/app/environments/[environmentId]/(actionsAndAttributes)/attributes/AttributeClassesTable";
import AttributeClassDataRow from "@/app/environments/[environmentId]/(actionsAndAttributes)/attributes/AttributeRowData";
import AttributeTableHeading from "@/app/environments/[environmentId]/(actionsAndAttributes)/attributes/AttributeTableHeading";
import HowToAddAttributesButton from "@/app/environments/[environmentId]/(actionsAndAttributes)/attributes/HowToAddAttributesButton";
import { getAttributeClasses } from "@formbricks/lib/services/attributeClass";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attributes",
};

export default async function AttributesPage({ params }) {
  let attributeClasses = await getAttributeClasses(params.environmentId);
  return (
    <>
      <AttributeClassesTable environmentId={params.environmentId} attributeClasses={attributeClasses}>
        <AttributeTableHeading />
        <HowToAddAttributesButton />

        {attributeClasses.map((attributeClass) => (
          <AttributeClassDataRow key={attributeClass.id} attributeClass={attributeClass} />
        ))}
      </AttributeClassesTable>
    </>
  );
}
