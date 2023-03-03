import { CustomersIcon, DashboardIcon, FormIcon } from "@formbricks/ui";
import { Disclosure } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";

interface LayoutWrapperOrganisationProps {
  children: React.ReactNode;
}

export default function LayoutWrapperOrganisation({ children }: LayoutWrapperOrganisationProps) {
  const router = useRouter();
  const navigation = useMemo(
    () => [
      {
        name: "Forms",
        href: `/organisations/${router.query.organisationId}/forms`,
        icon: FormIcon,
        current: router.pathname.includes("/form"),
      },
      {
        name: "Customers",
        href: `/organisations/${router.query.organisationId}/customers`,
        icon: CustomersIcon,
        current: router.pathname.includes("/customers"),
      },
      {
        name: "Integrations",
        href: `/organisations/${router.query.organisationId}/integrations`,
        icon: DashboardIcon,
        current: router.pathname.includes("/integrations"),
      },
    ],
    [router]
  );
  return (
    <div>
      <Disclosure as="header" className="bg-white shadow">
        {({ open }) => (
          <>
            <div className="mx-auto w-full px-2 sm:px-4 lg:divide-y lg:divide-slate-200 lg:px-8">
              <nav className="py-2" aria-label="Global">
                <div className="relative z-10 flex items-center sm:hidden">
                  {/* Mobile menu button */}
                  <Disclosure.Button className="focus:ring-brand inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-inset">
                    <span className="sr-only">Open menu</span>
                    {open ? (
                      <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                    )}
                  </Disclosure.Button>
                </div>
                <div className="hidden sm:flex lg:space-x-4">
                  {navigation.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={clsx(
                        item.current
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-900 hover:bg-slate-50 hover:text-slate-900",
                        "inline-flex items-center rounded-md py-2 px-3 text-sm font-medium"
                      )}
                      aria-current={item.current ? "page" : undefined}>
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </nav>
            </div>

            <Disclosure.Panel as="nav" className="lg:hidden" aria-label="Global">
              <div className="space-y-1 px-2 pt-2 pb-3">
                {navigation.map((item) => (
                  <Disclosure.Button
                    key={item.name}
                    onClick={() => router.push(item.href)}
                    className={clsx(
                      item.current
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-900 hover:bg-slate-50 hover:text-slate-900",
                      "block rounded-md py-2 px-3 text-base font-medium"
                    )}
                    aria-current={item.current ? "page" : undefined}>
                    {item.name}
                  </Disclosure.Button>
                ))}
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
      {children}
    </div>
  );
}
