import { useSession } from "next-auth/react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Logo } from "@/components/Logo";
import { LogoMark } from "@/components/LogoMark";
import { useState, useEffect } from "react";

interface Props {
  title?: string;
  onboarding?: boolean;
  children: React.ReactNode;
}

export default function LayoutAuth({ title = "Formbricks HQ", children, onboarding }: Props) {
  const { data: session } = useSession();
  const router = useRouter();

  const [variable, setVariable] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setVariable(true);
    }, 4000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

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
            <div className="mx-auto flex max-w-sm flex-1 flex-col justify-center px-4 py-12 xl:px-2">
              <div className="mx-auto w-96 rounded-xl bg-white p-8 shadow-xl">
                {onboarding ? (
                  <div className="bg-brand/10 border-brand mb-4 flex flex-col items-center justify-center rounded-xl border py-5">
                    {variable ? (
                      <LogoMark />
                    ) : (
                      <span className="relative flex h-5 w-5 pt-1">
                        <span className="bg-brand/75 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
                        <span className="bg-brand relative inline-flex h-5 w-5 rounded-full"></span>
                      </span>
                    )}
                    {variable ? (
                      <p className="text-brand pt-4 text-xs">Ready to roll 🤸</p>
                    ) : (
                      <p className="text-brand pt-4 text-xs">We&apos;re getting Formbricks ready for you.</p>
                    )}
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
