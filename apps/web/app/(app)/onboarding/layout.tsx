import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@formbricks/lib/authOptions";
import ToasterClient from "@formbricks/ui/ToasterClient";

export default async function EnvironmentLayout({ children }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  return (
    <div className="h-full w-full bg-slate-50">
      <ToasterClient />
      {children}
    </div>
  );
}
