export const revalidate = REVALIDATION_INTERVAL;

import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import EditProfile from "./EditProfile";

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  return <>{session && <EditProfile session={session} />}</>;
}
