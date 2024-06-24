import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { getIsMultiOrgEnabled } from "@formbricks/ee/lib/service";
import { authOptions } from "@formbricks/lib/authOptions";
import { getIsFreshInstance } from "@formbricks/lib/instance/service";

const AuthLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getServerSession(authOptions);
  const isFreshInstance = await getIsFreshInstance();
  const isMultiOrgEnabled = await getIsMultiOrgEnabled();
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

export default AuthLayout;
