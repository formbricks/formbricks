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
  return (
    <>
      <Toaster />
      <AttributionTracker />
      <div className="min-h-screen bg-slate-50">
        <div className="isolate bg-white">
          <div className="flex min-h-screen bg-gradient-radial from-slate-200 to-slate-50">{children}</div>
        </div>
      </div>
    </>
  );
};
