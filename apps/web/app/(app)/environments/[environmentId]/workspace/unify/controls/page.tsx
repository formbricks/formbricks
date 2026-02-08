import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { ControlsSection } from "./components";

export default async function UnifyControlsPage(props: { params: Promise<{ environmentId: string }> }) {
  const params = await props.params;

  await getEnvironmentAuth(params.environmentId);

  return <ControlsSection environmentId={params.environmentId} />;
}
