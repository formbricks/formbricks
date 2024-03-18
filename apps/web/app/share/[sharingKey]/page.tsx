import { redirect } from "next/navigation";

export default function EnvironmentPage({ params }) {
  return redirect(`/share/${params.sharingKey}/summary`);
}
