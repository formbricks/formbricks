"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaGithub, FaXTwitter, FaDiscord } from "react-icons/fa6";
import { Button } from "./Button";
import { navigation } from "./Navigation";

function PageLink({
  label,
  page,
  previous = false,
}: {
  label: string;
  page: { href: string; title: string };
  previous?: boolean;
}) {
  return (
    <>
      <Button
        href={page.href}
        aria-label={`${label}: ${page.title}`}
        variant="secondary"
        arrow={previous ? "left" : "right"}>
        {label}
      </Button>
      <Link
        href={page.href}
        tabIndex={-1}
        aria-hidden="true"
        className="text-base font-semibold text-slate-900 transition hover:text-slate-600 dark:text-white dark:hover:text-slate-300">
        {page.title}
      </Link>
    </>
  );
}

function PageNavigation() {
  let pathname = usePathname();
  let allPages = navigation.flatMap((group) => group.links);
  let currentPageIndex = allPages.findIndex((page) => page.href === pathname);

  if (currentPageIndex === -1) {
    return null;
  }

  let previousPage = allPages[currentPageIndex - 1];
  let nextPage = allPages[currentPageIndex + 1];

  if (!previousPage && !nextPage) {
    return null;
  }

  return (
    <div className="flex">
      {previousPage && (
        <div className="flex flex-col items-start gap-3">
          <PageLink label="Previous" page={previousPage} previous />
        </div>
      )}
      {nextPage && (
        <div className="ml-auto flex flex-col items-end gap-3">
          <PageLink label="Next" page={nextPage} />
        </div>
      )}
    </div>
  );
}

function SocialLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group">
      <span className="sr-only">{children}</span>
      <Icon className="h-5 w-5 fill-slate-700 transition group-hover:fill-slate-900 dark:group-hover:fill-slate-500" />
    </Link>
  );
}

function SmallPrint() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col items-center justify-between gap-5 border-t border-slate-900/5 pt-8 dark:border-white/5 sm:flex-row">
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Formbricks GmbH &copy; {currentYear}. All rights reserved.
      </p>
      <div className="flex gap-4">
        <SocialLink href="https://twitter.com/formbricks" icon={FaXTwitter}>
          Follow us on Twitter
        </SocialLink>
        <SocialLink href="https://github.com/formbricks/formbricks" icon={FaGithub}>
          Follow us on GitHub
        </SocialLink>
        <SocialLink href="https://formbricks.com/discord" icon={FaDiscord}>
          Join our Discord server
        </SocialLink>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-2xl space-y-10 pb-16 lg:max-w-5xl">
      <PageNavigation />
      <SmallPrint />
    </footer>
  );
}
