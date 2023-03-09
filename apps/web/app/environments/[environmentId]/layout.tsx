import EnvironmentsNavbar from "@/components/environments/EnvironmentsNavbar";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "pages/api/auth/[...nextauth]";

export default async function EnvironmentLayout({ children, params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return redirect(`/auth/login`);
  }

  return (
    <div>
      <EnvironmentsNavbar environmentId={params.environmentId} session={session} />
      <main className="mt-14 min-h-fit bg-slate-50">
        {children}
        <main />
      </main>
    </div>
  );
}
