import { HomeIcon } from "@heroicons/react/outline";
import Link from "next/link";
import { useForm } from "../../lib/forms";

export default function MenuBreadcrumbs({ formId }) {
  const { form, isLoadingForm } = useForm(formId);

  const pages = [
    { name: "Forms", href: "/forms", current: false },
    { name: form.name, href: "#", current: true },
  ];

  if (isLoadingForm) {
    return <div />;
  }

  return (
    <div className="hidden sm:flex sm:flex-1">
      <nav className="hidden lg:flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <div>
              <Link href="/forms/">
                <a className="text-gray-400 hover:text-gray-500">
                  <HomeIcon
                    className="flex-shrink-0 w-5 h-5"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Home</span>
                </a>
              </Link>
            </div>
          </li>
          {pages.map((page) => (
            <li key={page.name}>
              <div className="flex items-center">
                <svg
                  className="flex-shrink-0 w-5 h-5 text-gray-300"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                </svg>
                <a
                  href={page.href}
                  className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                  aria-current={page.current ? "page" : undefined}
                >
                  {page.name}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
