import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { SourcesSection } from "./components/sources-page-client";

export default async function UnifySourcesPage(props: { params: Promise<{ environmentId: string }> }) {
  const params = await props.params;

  await getEnvironmentAuth(params.environmentId);

  return <SourcesSection environmentId={params.environmentId} />;
}
