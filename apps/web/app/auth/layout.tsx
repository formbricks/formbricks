import { Logo } from "@/components/Logo";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (session) {
    redirect(`/`);
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="isolate bg-white">
        <div className="bg-gradient-radial flex min-h-screen from-slate-200 to-slate-50">
          <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
            <div className="mx-auto w-full max-w-sm rounded-xl bg-white p-8 shadow-xl lg:w-96">
              <div className="mb-8 text-center">
                <Logo className="mx-auto w-3/4" />
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
