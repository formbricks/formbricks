import { redirect } from "next/navigation";
import { Toaster } from "react-hot-toast";

import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { getOrganizationCount } from "@formbricks/lib/organization/service";

const SetupLayout = async ({ children }: { children: React.ReactNode }) => {
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
  const organizationCount = await getOrganizationCount();

  if (isMultiOrgEnabled || organizationCount) {
    redirect("/");
  }

  return (
    <>
      <Toaster />
      <div className="flex h-full w-full items-center justify-center bg-slate-50">{children}</div>
    </>
  );
};

export default SetupLayout;
