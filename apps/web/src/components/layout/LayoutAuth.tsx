import { useSession } from "next-auth/react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Logo } from "@/components/Logo";

interface Props {
  title?: string;
  children: React.ReactNode;
}

export default function LayoutAuth({ title = "Formbricks HQ", children }: Props) {
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
      <div className="min-h-screen bg-gray-50">
        {" "}
        <div className="isolate bg-white">
          <div className="bg-gradient-radial flex min-h-screen from-gray-200 to-gray-50">
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
    </>
  );
}
