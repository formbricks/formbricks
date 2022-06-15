import { signIn, useSession } from "next-auth/react";
import Head from "next/head";
import Loading from "../Loading";
import MenuBreadcrumbs from "./MenuBreadcrumbs";
import MenuProfile from "./MenuProfile";
import MenuSteps from "./MenuSteps";

export default function LayoutFormResults({
  title,
  formId,
  currentStep,
  children,
}) {
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
        <title>{title}</title>
      </Head>
      <div className="flex min-h-screen overflow-hidden bg-gray-100">
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="w-full">
            <div className="relative z-10 flex flex-shrink-0 h-16 bg-white border-b shadow-sm border-lightgray-200">
              <div className="flex flex-1 px-4 sm:px-6">
                <MenuBreadcrumbs formId={formId} />
                <MenuSteps formId={formId} currentStep={currentStep} />
                <div className="flex items-center justify-end flex-1 space-x-2 text-right sm:ml-6 sm:space-x-4">
                  {/* Profile dropdown */}
                  <MenuProfile />
                </div>
              </div>
            </div>
            <div className="relative z-10 flex flex-shrink-0 h-16 border-b border-gray-200 shadow-inner bg-gray-50">
              <div className="flex items-center justify-center flex-1 px-4">
                <nav className="flex space-x-4" aria-label="resultModes">
                  <button
                    onClick={() => {}}
                    className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-800 rounded-md hover:text-gray-600"
                  >
                    Save
                  </button>
                </nav>
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
