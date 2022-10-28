import Head from "next/head";
import Link from "next/link";

import { ArrowLeftIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
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

  return <>
    <Head>
      <title>Form Preview</title>
    </Head>
    <div className="flex min-h-screen overflow-hidden bg-gray-50">
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="w-full">
          <div className="border-ui-gray-light relative z-10 flex h-16 flex-shrink-0 border-b bg-white shadow-sm">
            <div className="flex flex-1 px-4 sm:px-6">
              <div className="flex flex-1 items-center">
                <Link href={`/forms/${formId}/form`}>

                  <ArrowLeftIcon className="h-6 w-6" aria-hidden="true" />

                </Link>
              </div>
              <p className="flex flex-1 items-center justify-center text-gray-600">Preview</p>
              <div className="flex flex-1 items-center justify-end space-x-2 text-right sm:ml-6 sm:space-x-4">
                <button
                  type="button"
                  onClick={() => resetApp()}
                  className="inline-flex items-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                  Restart
                  <ArrowPathIcon className="ml-2 -mr-1 h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        {children}
      </div>
    </div>
  </>;
}
