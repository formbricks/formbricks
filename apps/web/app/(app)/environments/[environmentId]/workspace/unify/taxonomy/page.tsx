import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { TaxonomySection } from "./components/TaxonomySection";

export default async function UnifyTaxonomyPage(props: { params: Promise<{ environmentId: string }> }) {
  const params = await props.params;

  await getEnvironmentAuth(params.environmentId);

  return <TaxonomySection environmentId={params.environmentId} />;
}
