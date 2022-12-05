"use client";

import { Disclosure } from "@headlessui/react";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export default function FormLayout({ params, children }) {
  const pathname = usePathname();
  const navigation = useMemo(
    () => [
      {
        name: "Form",
        href: `/app/teams/${params.teamId}/forms/${params.formId}/`,
        current: pathname.endsWith(params.formId),
      },
      {
        name: "Pipelines",
        href: `/app/teams/${params.teamId}/forms/${params.formId}/pipelines/`,
        current: pathname.includes("pipelines"),
      },
      {
        name: "Summary",
        href: `/app/teams/${params.teamId}/forms/${params.formId}/summary/`,
        current: pathname.includes("summary"),
      },
      {
        name: "Submissions",
        href: `/app/teams/${params.teamId}/forms/${params.formId}/submissions/`,
        current: pathname.includes("results"),
      },
    ],
    [params, pathname]
  );
  return (
    <>
      <Disclosure as="header" className="bg-white shadow">
        {({ open }) => (
          <>
            <div className="px-2 sm:px-4 lg:divide-y lg:divide-gray-200 lg:px-8">
              <nav className="hidden lg:flex lg:space-x-8 lg:py-2" aria-label="Global">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className={clsx(
                      item.current
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-900 hover:bg-gray-50 hover:text-gray-900",
                      "inline-flex items-center rounded-md py-2 px-3 text-sm font-medium"
                    )}
                    aria-current={item.current ? "page" : undefined}>
                    {item.name}
                  </a>
                ))}
              </nav>
            </div>

            <Disclosure.Panel as="nav" className="lg:block" aria-label="Global">
              <div className="space-y-1 px-2 pt-2 pb-3">
                {navigation.map((item) => (
                  <Disclosure.Button
                    key={item.name}
                    as="a"
                    href={item.href}
                    className={clsx(
                      item.current
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-900 hover:bg-gray-50 hover:text-gray-900",
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
    </>
  );
}
