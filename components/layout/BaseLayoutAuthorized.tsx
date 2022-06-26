import { signIn, useSession } from "next-auth/react";
import Head from "next/head";
import { classNames } from "../../lib/utils";
import Loading from "../Loading";
import MenuBreadcrumbs from "./MenuBreadcrumbs";
import MenuProfile from "./MenuProfile";
import MenuSteps from "./MenuSteps";
import NewFormNavButton from "./NewFormNavButton";

interface BaseLayoutAuthorizedProps {
  title: string;
  breadcrumbs: any;
  steps?: any;
  currentStep?: string;
  children: React.ReactNode;
  bgClass?: string;
  limitHeightScreen?: boolean;
}

export default function BaseLayoutAuthorized({
  title,
  breadcrumbs,
  steps,
  currentStep,
  children,
  bgClass = "bg-ui-gray-lighter",
  limitHeightScreen = false,
}: BaseLayoutAuthorizedProps) {
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
      <div
        className={classNames(
          bgClass,
          limitHeightScreen
            ? "h-screen max-h-screen overflow-hidden"
            : "min-h-screen",
          "flex h-full"
        )}
      >
        <div className="flex flex-col flex-1 h-full">
          <header className="w-full">
            <div className="relative z-10 flex flex-shrink-0 h-16 bg-white border-b shadow-sm border-ui-gray-light">
              <div className="flex justify-between flex-1">
                <div className="flex flex-1 space-x-8">
                  <NewFormNavButton />
                  <MenuBreadcrumbs breadcrumbs={breadcrumbs} />
                </div>
                <div className="flex flex-1">
                  {steps && (
                    <MenuSteps steps={steps} currentStep={currentStep} />
                  )}
                </div>
                <div className="flex items-center justify-end flex-1 space-x-2 text-right sm:space-x-4">
                  <div className="mr-6">
                    <MenuProfile />
                  </div>
                </div>
              </div>
            </div>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
