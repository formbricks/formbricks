"use client";

import { navigation } from "@/lib/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "./button";
import { DiscordIcon } from "./icons/discord-icon";
import { GithubIcon } from "./icons/github-icon";
import { TwitterIcon } from "./icons/twitter-icon";

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

function PageNavigation(): React.JSX.Element | null {
  const pathname = usePathname();
  const allPages = navigation.flatMap((group) => {
    return group.links.flatMap((link) => {
      return link.children ? link.children : link;
    });
  });
  const currentPageIndex = allPages.findIndex((page) => page.href === pathname);

  if (currentPageIndex === -1) {
    return null;
  }

  const previousPage = allPages[currentPageIndex - 1];
  const nextPage = allPages[currentPageIndex + 1];

  return (
    <div className="flex">
      {previousPage?.href ? (
        <div className="flex flex-col items-start gap-3">
          <PageLink label="Previous" page={previousPage} previous />
        </div>
      ) : null}
      {nextPage?.href ? (
        <div className="ml-auto flex flex-col items-end gap-3">
          <PageLink label="Next" page={nextPage} />
        </div>
      ) : null}
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
}): React.JSX.Element {
  return (
    <Link href={href} className="group">
      <span className="sr-only">{children}</span>
      <Icon className="h-5 w-5 fill-slate-700 transition group-hover:fill-slate-900 dark:group-hover:fill-slate-500" />
    </Link>
  );
}

function SmallPrint(): React.JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col items-center justify-between gap-5 border-t border-slate-900/5 pt-8 sm:flex-row dark:border-white/5">
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Formbricks GmbH &copy; {currentYear}. All rights reserved.
      </p>
      <div className="flex gap-4">
        <SocialLink href="https://twitter.com/formbricks" icon={TwitterIcon}>
          Follow us on Twitter
        </SocialLink>
        <SocialLink href="https://github.com/formbricks/formbricks" icon={GithubIcon}>
          Follow us on GitHub
        </SocialLink>
        <SocialLink href="https://formbricks.com/discord" icon={DiscordIcon}>
          Join our Discord server
        </SocialLink>
      </div>
    </div>
  );
}

export function Footer(): React.JSX.Element {
  return (
    <footer className="my-10 flex-auto pb-16">
      <PageNavigation />
      <SmallPrint />
    </footer>
  );
}
