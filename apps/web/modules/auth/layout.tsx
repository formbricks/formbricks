import { redirect } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { getIsFreshInstance } from "@/lib/instance/service";
import { AttributionTracker } from "@/modules/auth/components/attribution-tracker";
import { getSession } from "@/modules/auth/lib/session";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

export const AuthLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const [session, isFreshInstance, isMultiOrgEnabled] = await Promise.all([
    getSession(),
    getIsFreshInstance(),
    getIsMultiOrgEnabled(),
  ]);

  if (session) {
    redirect(`/`);
  }

  if (isFreshInstance && !isMultiOrgEnabled) {
    redirect("/setup/intro");
  }

  // The backdrop and centring live in FormWrapper so the routes outside this layout
  // (/invite, /verify-email-change, /email-change-without-verification-success) get
  // the same shell instead of hand-copying one.
  return (
    <>
      <Toaster />
      <AttributionTracker />
      {children}
    </>
  );
};
