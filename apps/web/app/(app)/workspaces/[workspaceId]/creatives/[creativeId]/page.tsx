import { redirect } from "next/navigation";
import { getCreativeSummaryPath } from "@/modules/creatives/lib/paths";

const CreativePage = async (
  props: Readonly<{ params: Promise<{ workspaceId: string; creativeId: string }> }>
) => {
  const { workspaceId, creativeId } = await props.params;
  redirect(getCreativeSummaryPath(workspaceId, creativeId));
};

export default CreativePage;
