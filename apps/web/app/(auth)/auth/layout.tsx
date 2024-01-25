import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Toaster } from "react-hot-toast";

import { authOptions } from "@formbricks/lib/authOptions";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(`/`);
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
}
