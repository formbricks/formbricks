import { redirect } from "next/navigation";

export default function EnvironmentPage({ params }) {
  return redirect(`/environments/${params.environmentId}/surveys`);
}
