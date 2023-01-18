import Head from "next/head";
import Image from "next/image";
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
          limitHeightScreen
            ? "h-screen max-h-screen overflow-hidden"
            : "min-h-screen",
          "flex h-full"
        )}
      >
        <div
          className={classNames(
            limitHeightScreen ? "max-h-full" : "h-full",
            "flex flex-col flex-1 w-full"
          )}
        >
          <header className='w-full'>
            <div className='relative z-10 flex flex-shrink-0 h-16 bg-white border-b shadow-sm border-ui-gray-light max-sm:pr-2 max-sm:pl-2 max-md:pr-2 max-md:pl-2'>
              <div className='grid w-full grid-cols-2 sm:grid-cols-3'>
                <div className='flex-1  space-x-8 sm:flex'>
                  <div className='sm:w-fit m-auto flex items-center h-full'>
                    <Image
                      src='/img/kda_logo.png'
                      alt='kinshasa digital academy logo'
                      width={100}
                      height={40}
                    />
                  </div>
                  <NewFormNavButton />
                  <MenuBreadcrumbs breadcrumbs={breadcrumbs} />
                </div>
                <div className='hidden sm:flex sm:flex-1'>
                  {steps && (
                    <MenuSteps steps={steps} currentStep={currentStep} />
                  )}
                </div>
                <div className='flex items-center justify-end flex-1 space-x-2 text-right sm:space-x-4'>
                  <div className='mr-6'>
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
