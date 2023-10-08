export const revalidate = REVALIDATION_INTERVAL;

import AttributeClassesTable from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/AttributeClassesTable";
import AttributeClassDataRow from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/AttributeRowData";
import AttributeTableHeading from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/AttributeTableHeading";
import HowToAddAttributesButton from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/HowToAddAttributesButton";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { Metadata } from "next";

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
