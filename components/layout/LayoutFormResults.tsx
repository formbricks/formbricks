import { signIn, useSession } from "next-auth/react";
import Head from "next/head";
import { classNames } from "../../lib/utils";
import Loading from "../Loading";
import MenuBreadcrumbs from "./MenuBreadcrumbs";
import MenuProfile from "./MenuProfile";
import MenuSteps from "./MenuSteps";

export default function LayoutFormResults({
  title,
  formId,
  resultMode,
  setResultMode,
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

  const resultModes = [
    { name: "Summary", id: "summary", icon: "" },
    { name: "Responses", id: "responses", icon: "" },
    { name: "Analytics", id: "analytics", icon: "" },
  ];
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div className="flex min-h-screen overflow-hidden bg-ui-gray-lighter">
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="w-full">
            <div className="relative z-10 flex flex-shrink-0 h-16 bg-white border-b shadow-sm border-ui-gray-light">
              <div className="flex flex-1 px-4 sm:px-6">
                <MenuBreadcrumbs formId={formId} />
                <MenuSteps formId={formId} currentStep={currentStep} />
                <div className="flex items-center justify-end flex-1 space-x-2 text-right sm:ml-6 sm:space-x-4">
                  {/* Profile dropdown */}
                  <MenuProfile />
                </div>
              </div>
            </div>
            <div className="relative z-10 flex flex-shrink-0 h-16 border-b shadow-inner border-ui-gray-light bg-gray-50">
              <div className="flex items-center justify-center flex-1 px-4">
                <nav className="flex space-x-4" aria-label="resultModes">
                  {resultModes.map((mode) => (
                    <button
                      key={mode.name}
                      onClick={() => setResultMode(mode.id)}
                      className={classNames(
                        mode.id === resultMode
                          ? "bg-ui-gray-light text-gray-800"
                          : "text-gray-600 hover:text-gray-800",
                        "px-3 py-2 font-medium text-sm rounded-md"
                      )}
                      aria-current={mode.id === resultMode ? "page" : undefined}
                    >
                      {mode.name}
                    </button>
                  ))}
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
