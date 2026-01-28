import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { AnalyzeSection } from "./components";

export default async function AnalyzePage(props: { params: Promise<{ environmentId: string }> }) {
  const params = await props.params;

  await getEnvironmentAuth(params.environmentId);

  return <AnalyzeSection environmentId={params.environmentId} />;
}
