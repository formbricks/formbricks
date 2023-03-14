import { redirect } from "next/navigation";

export default function ProfileSettingsPage({ params }) {
  return redirect(`/environments/${params.environmentId}/settings/profile`);
}
