import { redirect } from "next/navigation";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";

/** The Data retention index opens on its first tab. */
const Page = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await props.params;
  redirect(organizationSettingsPath(organizationId, "data-retention/history"));
};

export default Page;
