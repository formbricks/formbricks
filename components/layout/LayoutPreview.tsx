import Head from "next/head";
import Link from "next/link";

import { ArrowLeftIcon, RefreshIcon } from "@heroicons/react/outline";
import { useSession, signIn } from "next-auth/react";
import Loading from "../Loading";

export default function LayoutShare({ formId, resetApp, children }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Loading />;
  }

  if (!session) {
    signIn();
    return <div>You need to be authenticated to view this page.</div>;
  }

  return (
    <>
      <Head>
        <title>Form Preview</title>
      </Head>
      <div className="flex min-h-screen overflow-hidden bg-gray-50">
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="w-full">
            <div className="relative z-10 flex flex-shrink-0 h-16 bg-white border-b shadow-sm border-ui-gray-light">
              <div className="flex flex-1 px-4 sm:px-6">
                <div className="flex items-center flex-1">
                  <Link href={`/forms/${formId}/form`}>
                    <a>
                      <ArrowLeftIcon className="w-6 h-6" aria-hidden="true" />
                    </a>
                  </Link>
                </div>
                <p className="flex items-center justify-center flex-1 text-gray-600">
                  Preview
                </p>
                <div className="flex items-center justify-end flex-1 space-x-2 text-right sm:ml-6 sm:space-x-4">
                  <button
                    type="button"
                    onClick={() => resetApp()}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Restart
                    <RefreshIcon
                      className="w-5 h-5 ml-2 -mr-1"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Main content */}
          {children}
        </div>
      </div>
    </>
  );
}
