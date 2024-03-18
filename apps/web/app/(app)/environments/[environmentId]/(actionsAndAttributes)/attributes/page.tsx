import { AttributeClassesTable } from "@/app/(app)/environments/[environmentId]/(actionsAndAttributes)/attributes/components/AttributeClassesTable";
import { Metadata } from "next";

import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";

export const metadata: Metadata = {
  title: "Attributes",
};

export default async function AttributesPage({ params }) {
  let attributeClasses = await getAttributeClasses(params.environmentId);

  return (
    <>
      <AttributeClassesTable attributeClasses={attributeClasses} />
    </>
  );
}
