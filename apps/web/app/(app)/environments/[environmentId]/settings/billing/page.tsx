import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { getServerSession } from "next-auth";
import SettingsTitle from "../SettingsTitle";
import PricingTable from "./PricingTable";

export default async function ProfileSettingsPage({ params }) {
  const session = await getServerSession(authOptions);
  return (
    <div>
      <SettingsTitle title="Billing & Plan" />
      <PricingTable environmentId={params.environmentId} session={session} />
    </div>
  );
}
