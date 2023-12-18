import AttributeClassesTable from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/components/AttributeClassesTable";
import AttributeClassDataRow from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/components/AttributeRowData";
import AttributeTableHeading from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/components/AttributeTableHeading";
import HowToAddAttributesButton from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/components/HowToAddAttributesButton";
import { Metadata } from "next";

import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";

export const metadata: Metadata = {
  title: "Attributes",
};

export default async function AttributesPage({ params }) {
  let attributeClasses = await getAttributeClasses(params.environmentId);

  return (
    <>
      <AttributeClassesTable attributeClasses={attributeClasses}>
        <AttributeTableHeading />
        <HowToAddAttributesButton />

        {attributeClasses.map((attributeClass) => (
          <AttributeClassDataRow key={attributeClass.id} attributeClass={attributeClass} />
        ))}
      </AttributeClassesTable>
    </>
  );
}
