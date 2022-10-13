import { HomeIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function MenuBreadcrumbs({ breadcrumbs }) {
  return (
    <div className="hidden overflow-hidden text-ellipsis sm:flex sm:flex-1">
      <nav className="hidden lg:flex" aria-label="Breadcrumb">
        <ol className="flex items-center space-x-4">
          <li>
            <div>
              <Link href="/forms/">
                <a className="text-ui-gray-dark hover:text-ui-gray-dark">
                  <HomeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="sr-only">Home</span>
                </a>
              </Link>
            </div>
          </li>
          {breadcrumbs.map((crumb) => (
            <li key={crumb.name}>
              <div className="flex items-center">
                <svg
                  className="text-ui-gray-medium h-5 w-5 flex-shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true">
                  <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                </svg>
                <a
                  href={crumb.href}
                  className="text-ui-gray-dark hover:text-ui-gray-dark ml-4 truncate text-sm font-medium">
                  {crumb.name}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
