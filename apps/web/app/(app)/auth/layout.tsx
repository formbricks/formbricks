import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PosthogClientWrapper } from "../PosthogClientWrapper";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (session) {
    redirect(`/`);
  }
  return (
    <PosthogClientWrapper>
      <div className="min-h-screen bg-slate-50">
        <div className="isolate bg-white">
          <div className="bg-gradient-radial flex min-h-screen from-slate-200 to-slate-50">{children}</div>
        </div>
      </div>
    </PosthogClientWrapper>
  );
}
