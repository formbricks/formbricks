import { redirect } from "next/navigation";

export default async function UnifyPage(props: { params: Promise<{ environmentId: string }> }) {
  const params = await props.params;
  redirect(`/environments/${params.environmentId}/workspace/unify/sources`);
}
