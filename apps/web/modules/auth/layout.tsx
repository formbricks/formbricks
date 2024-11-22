import { authOptions } from "@/modules/auth/lib/authOptions";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";

export const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  const [session, isFreshInstance, isMultiOrgEnabled] = await Promise.all([
    getServerSession(authOptions),
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
      <div className="min-h-screen bg-slate-50">
        <div className="isolate bg-white">
          <div className="bg-gradient-radial flex min-h-screen from-slate-200 to-slate-50">{children}</div>
        </div>
      </div>
    </>
  );
};
