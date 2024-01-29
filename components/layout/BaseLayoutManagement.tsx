import { useSession } from "next-auth/react";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { classNames } from "../../lib/utils";
import MenuProfile from "./MenuProfile";
import MenuSteps from "./MenuSteps";
import { useRouter } from "next/router";
import Loading from "../Loading";

interface BaseLayoutManagementProps {
  title: string;
  children: React.ReactNode;
  breadcrumbs?: any;
  steps?: any;
  currentStep?: string;
  activeMenu?: string;
  bgClass?: string;
  limitHeightScreen?: boolean;
}

export default function BaseLayoutManagement({
  title,
  steps,
  currentStep,
  children,
  bgClass = "bg-ui-gray-lighter",
  limitHeightScreen = false,
  activeMenu,
}: BaseLayoutManagementProps) {
  const session = useSession();
  const { user } = session.data;
  const adminMenus = [
    { id: "forms", name: "Sourcings", href: "/" },
    { id: "users", name: "Gestion d'utilisateurs", href: "/users" },
  ];
  const router = useRouter();
  const { asPath } = router;
  if (!user.profileIsValid) {
    router.push({
      pathname: `/users/update-profile`,
      query: { next: asPath }
    });
    return <Loading />;
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
        <div
          className={classNames(
            limitHeightScreen ? "max-h-full" : "h-full",
            "flex flex-row flex-wrap flex-1 w-full min-h-screen"
          )}
        >
          <header className="w-full">
            <div className="relative z-10 flex flex-shrink-0 h-16 bg-white border-b shadow-sm border-ui-gray-light max-sm:pr-2 max-sm:pl-2 max-md:pr-2 max-md:pl-2">
              <div className="grid w-full grid-cols-3 ">
                <div className="flex-1  space-x-2 sm:flex justify-start ">
                  <div className="sm:w-fit ml-6 flex items-center h-full">
                    <Link href="/forms/">
                      <a className="text-ui-gray-dark hover:text-ui-gray-dark">
                        <Image
                          src="/img/kadea_logo.png"
                          alt="Kadea  academy logo"
                          width={140}
                          height={30}
                        />
                      </a>
                    </Link>
                  </div>

                  {user.role === "ADMIN" && (
                    <div className="flex-1 hidden  space-x-2 lg:flex items-center ">
                      {adminMenus && (
                        <MenuSteps
                          steps={adminMenus}
                          currentStep={activeMenu}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className=" flex sm:flex-1 items-center justify-center">
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
          <div className="flex flex-col w-full">{children}</div>
          <footer className="w-full self-end bg-red flex flex-col justify-between items-center py-6 ">
            <div className="flex flex-col  justify-between items-center ">
              <Link href="/forms/">
                <a className="text-ui-gray-dark hover:text-ui-gray-dark">
                  <Image
                    src="/img/logo-white.webp"
                    alt="Kadea  academy logo"
                    width={140}
                    height={30}
                  />
                </a>
              </Link>
              <p className="text-center py-4 lg:text-left text-white">
                {
                  "Si tu as des questions, n'hésites pas à contacter l'équipe chargée des admissions par courrier électronique"
                }
              </p>
              <address>
                <a
                  className="text-center py-4 lg:text-left text-white"
                  href="mailto:admissions@kadea.co"
                >
                  admissions@kadea.co
                </a>
              </address>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
