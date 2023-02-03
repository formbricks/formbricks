"use client";

import { Disclosure } from "@headlessui/react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/router";
import { useMemo } from "react";

export default function LayoutWrapperCustomForm({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useMemo(
    () => [
      {
        name: "Form",
        href: `/organisations/${router.query.organisationId}/forms/${router.query.formId}/custom/`,
        current: pathname.endsWith("custom") || pathname.endsWith("custom/"),
      },
      {
        name: "Pipelines",
        href: `/organisations/${router.query.organisationId}/forms/${router.query.formId}/custom/pipelines/`,
        current: pathname.includes("pipelines"),
      },
      {
        name: "Summary",
        href: `/organisations/${router.query.organisationId}/forms/${router.query.formId}/custom/summary/`,
        current: pathname.includes("summary"),
      },
      {
        name: "Submissions",
        href: `/organisations/${router.query.organisationId}/forms/${router.query.formId}/custom/submissions/`,
        current: pathname.includes("submissions"),
      },
    ],
    [router, pathname]
  );
  return (
    <>
      <Disclosure as="header" className="bg-white shadow">
        {({}) => (
          <>
            <div className="px-2 sm:px-4 lg:divide-y lg:divide-gray-200 lg:px-8">
              <nav className="hidden lg:flex lg:space-x-8 lg:py-2" aria-label="Global">
                {navigation.map((item) => (
                  <Link
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
                  </Link>
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
