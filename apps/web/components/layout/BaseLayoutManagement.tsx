import Head from "next/head";
import { classNames } from "../../lib/utils";
import MenuBreadcrumbs from "./MenuBreadcrumbs";
import MenuProfile from "./MenuProfile";
import MenuSteps from "./MenuSteps";
import NewFormNavButton from "./NewFormNavButton";

interface BaseLayoutManagementProps {
  title: string;
  breadcrumbs: any;
  steps?: any;
  currentStep?: string;
  children: React.ReactNode;
  bgClass?: string;
  limitHeightScreen?: boolean;
}

export default function BaseLayoutManagement({
  title,
  breadcrumbs,
  steps,
  currentStep,
  children,
  bgClass = "bg-ui-gray-lighter",
  limitHeightScreen = false,
}: BaseLayoutManagementProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <div
        className={classNames(
          bgClass,
          limitHeightScreen ? "h-screen max-h-screen overflow-hidden" : "min-h-screen",
          "flex h-full"
        )}>
        <div
          className={classNames(limitHeightScreen ? "max-h-full" : "h-full", "flex w-full flex-1 flex-col")}>
          <header className="w-full">
            <div className="border-ui-gray-light relative z-10 flex h-16 flex-shrink-0 border-b bg-white shadow-sm">
              <div className="grid w-full grid-cols-2 sm:grid-cols-3">
                <div className="hidden flex-1 space-x-8 sm:flex">
                  <NewFormNavButton />
                  <MenuBreadcrumbs breadcrumbs={breadcrumbs} />
                </div>
                <div className="flex flex-1">
                  {steps && <MenuSteps steps={steps} currentStep={currentStep} />}
                </div>
                <div className="flex flex-1 items-center justify-end space-x-2 text-right sm:space-x-4">
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
