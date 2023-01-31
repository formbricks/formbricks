import { useSession } from "next-auth/react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Logo } from "@/components/Logo";
import { LogoMark } from "@/components/LogoMark";
import clsx from "clsx";

interface Props {
  title?: string;
  onboarding?: boolean;
  children: React.ReactNode;
}

export default function LayoutAuth({ title = "Formbricks HQ", children, onboarding }: Props) {
  const { data: session } = useSession();
  const router = useRouter();

  if (session) {
    router.push("/");
  }
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className="min-h-screen bg-slate-50">
        {" "}
        <div className="isolate bg-white">
          <div className="bg-gradient-radial flex min-h-screen from-slate-200 to-slate-50">
            <div
              className={clsx(
                "v mx-auto flex flex-1 flex-col justify-center px-4 py-12 xl:px-2",
                onboarding ? "max-w-3xl" : "max-w-sm"
              )}>
              <div
                className={clsx(
                  "mx-auto rounded-xl bg-white p-8 shadow-xl",
                  onboarding ? "md:px-10" : "w-full"
                )}>
                {onboarding ? (
                  <div className="h-8">
                    <LogoMark />
                  </div>
                ) : (
                  <div className="mx-auto mb-8 w-3/4">
                    <Logo />
                  </div>
                )}

                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
