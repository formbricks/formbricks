import { redirect } from "next/navigation";

export default async function AnalysisPage({ params }: { params: Promise<{ environmentId: string }> }) {
  const { environmentId } = await params;
  if (!environmentId || environmentId === "undefined") {
    redirect("/");
  }
  redirect(`/environments/${environmentId}/analysis/dashboards`);
}
