import { redirect } from "next/navigation";
import { workspaceSettingsPath } from "@/modules/settings/lib/routes";

// Legacy redirect: the app-connection page lives under settings, but older links (bookmarks,
// external references, stale clients) point at the bare /workspaces/[workspaceId]/app-connection
// path. Keep that URL working by redirecting it to the canonical settings location.
const Page = async (props: Readonly<{ params: Promise<{ workspaceId: string }> }>) => {
  const params = await props.params;
  return redirect(workspaceSettingsPath(params.workspaceId, "app-connection"));
};

export default Page;
