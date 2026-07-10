import { redirect } from "next/navigation";

export default async function FeedbackSourcesRedirect(
  props: Readonly<{ params: Promise<{ workspaceId: string }> }>
) {
  const { workspaceId } = await props.params;
  redirect(`/workspaces/${workspaceId}/unify/sources`);
}
