import EnvironmentsNavbar from "@/app/environments/[environmentId]/EnvironmentsNavbar";
import ToasterClient from "@/components/ToasterClient";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "pages/api/auth/[...nextauth]";
import PosthogIdentify from "./PosthogIdentify";

export default async function EnvironmentLayout({ children, params }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return redirect(`/auth/login`);
  }

  return (
    <>
      {<PosthogIdentify session={session} />}
      <ToasterClient />
      <EnvironmentsNavbar environmentId={params.environmentId} session={session} />
      <main className="h-full flex-1 overflow-y-auto bg-slate-50">
        {children}
        <main />
      </main>
    </>
  );
}
