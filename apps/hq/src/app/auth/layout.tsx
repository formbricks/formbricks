"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Logo } from "../Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (session) {
    router.push("/projects");
  }
  return (
    <div className="isolate bg-white">
      <div className="bg-gradient-radial flex min-h-screen from-gray-200 to-gray-50">
        <div className="mx-auto flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm rounded-xl bg-white p-8 shadow-xl lg:w-96">
            <div className="mb-8">
              <Logo className="fill-zinc-900 px-16" />
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
