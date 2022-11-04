import Link from "next/link";
import clsx from "clsx";
import { Logo } from "./Logo";

const navigation = {
  creation: [
    { name: "React Form Builder", href: "/react-form-builder", status: true },
    { name: "Visual Builder", href: "/visual-builder", status: true },
    { name: "Templates", href: "#", status: false },
  ],
  pipelines: [
    { name: "Core API", href: "/core-api", status: true },
    { name: "Webhooks", href: "/webhooks", status: true },
    { name: "Email", href: "/email", status: true },
    { name: "Integrations", href: "#", status: false },
  ],
  insights: [
    { name: "Form HQ", href: "/form-hq", status: true },
    { name: "Reports", href: "#", status: false },
  ],
  legal: [
    { name: "Community", href: "/community" },
    { name: "Docs", href: "/docs" },
    { name: "Blog", href: "/blog" },
  ],
  social: [
    {
      name: "Twitter",
      href: "https://twitter.com/formbricks",
      icon: (props: any) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
        </svg>
      ),
    },
    {
      name: "GitHub",
      href: "https://github.com/formbricks/formbricks",
      icon: (props: any) => (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
          <path
            fillRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  ],
};

export default function Footer() {
  return (
    <footer
      className="dark:from-blue bg-gradient-to-b from-blue-100 to-blue-300 dark:to-black"
      aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8 xl:col-span-1">
            <Logo className="h-8 w-auto sm:h-10" />
            <p className="text-base text-blue-600 dark:text-blue-400">
              The Open Source Forms & Survey Toolbox
            </p>
            <div className="flex space-x-6">
              {navigation.social.map((item) => (
                <Link key={item.name} href={item.href} className="text-blue-400 hover:text-gray-400">
                  <span className="sr-only">{item.name}</span>
                  <item.icon className="h-6 w-6" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-50">Form Creation</h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.creation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        scroll={item.status}
                        className={clsx(
                          item.status
                            ? "cursor-pointer text-blue-700 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                            : "cursor-default text-blue-300 dark:text-blue-600",
                          "text-base"
                        )}>
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-50">Data Pipelines</h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.pipelines.map((item) => (
                    <li key={item.name}>
                      <Link
                        scroll={item.status}
                        href={item.href}
                        className={clsx(
                          item.status
                            ? "cursor-pointer text-blue-700 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                            : "cursor-default text-blue-300 dark:text-blue-600",
                          "text-base"
                        )}>
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-50">Data Insights</h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.insights.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        scroll={item.status}
                        className={clsx(
                          item.status
                            ? "cursor-pointer text-blue-700 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300"
                            : "cursor-default text-blue-300 dark:text-blue-600",
                          "text-base"
                        )}>
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-50">Other</h3>
                <ul role="list" className="mt-4 space-y-4">
                  {navigation.legal.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-base text-blue-700 hover:text-blue-400 dark:text-blue-400 dark:hover:text-blue-300">
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 border-gray-500 pt-8">
          <p className="text-sm text-blue-600 dark:text-gray-300 xl:text-center">
            &copy; 2022 Form Bricks, Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
