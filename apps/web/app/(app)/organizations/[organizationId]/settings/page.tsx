import { redirect } from "next/navigation";
import { organizationSettingsPath } from "@/modules/settings/lib/routes";

const Page = async (props: Readonly<{ params: Promise<{ organizationId: string }> }>) => {
  const { organizationId } = await props.params;
  redirect(organizationSettingsPath(organizationId, "general"));
};

export default Page;
