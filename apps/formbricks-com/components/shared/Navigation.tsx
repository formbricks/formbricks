import Link from "next/link";
import { useRouter } from "next/router";
import clsx from "clsx";

interface NavigationProps {
  navigation: {
    title: string;
    links: {
      title: string;
      href: string;
    }[];
  }[];
  className: string;
}

export function Navigation({ navigation, className }: NavigationProps) {
  let router = useRouter();

  return (
    <nav className={clsx("text-base lg:text-sm", className)}>
      <ul role="list" className="space-y-9">
        {navigation.map((section) => (
          <li key={section.title}>
            <h2 className="font-display text-blue font-medium dark:text-white">{section.title}</h2>
            <ul
              role="list"
              className="mt-2 space-y-2 border-l-2 border-blue-100 dark:border-blue-800 lg:mt-4 lg:space-y-4 lg:border-blue-200">
              {section.links.map((link) => (
                <li key={link.href} className="relative">
                  <Link
                    href={link.href}
                    className={clsx(
                      "block w-full pl-3.5 before:pointer-events-none before:absolute before:-left-1 before:top-1/2 before:h-1.5 before:w-1.5 before:-translate-y-1/2 before:rounded-full",
                      link.href === router.pathname
                        ? "font-semibold text-sky-500 before:bg-sky-500"
                        : "text-blue-500 before:hidden before:bg-blue-300 hover:text-blue-600 hover:before:block dark:text-blue-400 dark:before:bg-blue-700 dark:hover:text-blue-300"
                    )}>
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
