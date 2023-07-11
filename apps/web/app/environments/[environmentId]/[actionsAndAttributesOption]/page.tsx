import ActionClassesComponent from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(actions)/ActionClassesComponent";
import ActionLoader from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(actions)/ActionLoader";
import AttributeClassesComponent from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(attributes)/AttributeClassesComponent";
import AttributeLoader from "@/app/environments/[environmentId]/[actionsAndAttributesOption]/(attributes)/AttributeLoader";
import { Suspense } from "react";

export default function ActiondAndAttributesPage({ params }) {
  if (params.actionsAndAttributesOption === "actions")
    return (
      <Suspense fallback={<ActionLoader />}>
        <ActionClassesComponent environmentId={params.environmentId} />
      </Suspense>
    );
  else if (params.actionsAndAttributesOption === "attributes")
    return (
      <Suspense fallback={<AttributeLoader />}>
        <AttributeClassesComponent environmentId={params.environmentId} />
      </Suspense>
    );
  return <></>;
}
