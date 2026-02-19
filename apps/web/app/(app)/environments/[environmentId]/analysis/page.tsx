import { redirect } from "next/navigation";

const AnalysisPage = async (props: { params: Promise<{ environmentId: string }> }) => {
  const { environmentId } = await props.params;
  return redirect(`/environments/${environmentId}/analysis/dashboards`);
};

export default AnalysisPage;
