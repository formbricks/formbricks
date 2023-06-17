import { FooterLogo } from "@/components/shared/Logo";
import { MobileNavigation } from "@/components/shared/MobileNavigation";
import { Navigation } from "@/components/shared/Navigation";
import { Prose } from "@/components/shared/Prose";
import { Search } from "@/components/shared/Search";
import { ThemeSelector } from "@/components/shared/ThemeSelector";
import navigation from "@/lib/docsNavigation";
import { Button } from "@formbricks/ui";
import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import MetaInformation from "../shared/MetaInformation";
import DocsFeedback from "./DocsFeedback";
import { useRef } from "react";

function GitHubIcon(props: any) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z" />
    </svg>
  );
}

function Header({ navigation }: any) {
  const router = useRouter();
  let [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={clsx(
        "sticky top-0 z-50 flex flex-wrap items-center justify-between bg-slate-100 px-4 py-5 shadow-md shadow-slate-900/5 transition duration-500 dark:shadow-none sm:px-6 lg:px-8",
        isScrolled
          ? "bg-slate-100/90 backdrop-blur dark:bg-slate-900/90 [@supports(backdrop-filter:blur(0))]:bg-slate-100/75 dark:[@supports(backdrop-filter:blur(0))]:bg-slate-900/75"
          : "dark:bg-transparent"
      )}>
      <div className="mr-6 flex lg:hidden">
        <MobileNavigation navigation={navigation} />
      </div>
      <div className="relative flex flex-grow basis-0 items-center">
        <Link href="/" aria-label="Home page">
          <FooterLogo className="h-8 w-auto sm:h-10" />
        </Link>
      </div>
      <div className="-my-5 mr-6 sm:mr-8 md:mr-0">
        <Search />
      </div>
      <div className="hidden items-center justify-end md:flex md:flex-1 lg:w-0">
        <ThemeSelector className="relative z-10 mr-5" />

        <Button
          variant="secondary"
          EndIcon={GitHubIcon}
          endIconClassName="fill-slate-800 dark:fill-slate-200 ml-2"
          onClick={() => router.push("https://github.com/formbricks/formbricks")}>
          View on Github
        </Button>
        <Button
          variant="highlight"
          className="ml-2"
          onClick={() => router.push("https://app.formbricks.com/auth/signup")}>
          Get started
        </Button>
      </div>
    </header>
  );
}

interface LayoutProps {
  children: React.ReactNode;
  meta: {
    title: string;
    description?: string;
  };
}

export const Layout: React.FC<LayoutProps> = ({ children, meta }) => {
  let router = useRouter();
  let allLinks = navigation.flatMap((section) => section.links);
  let linkIndex = allLinks.findIndex((link) => link.href === router.pathname);
  let previousPage = allLinks[linkIndex - 1];
  let nextPage = allLinks[linkIndex + 1];
  let section = navigation.find((section) => section.links.find((link) => link.href === router.pathname));

  const linkRef = useRef<HTMLLIElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const preserveScroll = () => {
    const scroll = Math.abs(linkRef.current.getBoundingClientRect().top - linkRef.current.offsetTop);
    sessionStorage.setItem("scrollPosition", (scroll + 89).toString());
  };

  useEffect(() => {
    if (parentRef.current) {
      const scrollPosition = Number.parseInt(sessionStorage.getItem("scrollPosition"), 10);
      if (scrollPosition) {
        parentRef.current.scrollTop = scrollPosition;
      }
    }
  }, []);

  return (
    <>
      <MetaInformation
        title={`Formbricks Docs | ${meta.title}`}
        description={
          meta.description ? meta.description : "Open-source Experience Management for Digital Products."
        }
      />
      <Header navigation={navigation} />

      <div className="max-w-8xl relative mx-auto flex justify-center sm:px-2 lg:px-8 xl:px-12">
        <div className="hidden lg:relative lg:block lg:flex-none">
          <div className="absolute inset-y-0 right-0 w-[50vw] bg-slate-50 dark:hidden" />
          <div className="absolute bottom-0 right-0 top-16 hidden h-12 w-px bg-gradient-to-t from-slate-800 dark:block" />
          <div className="absolute bottom-0 right-0 top-28 hidden w-px bg-slate-800 dark:block" />
          <div
            className="sticky top-[4.5rem] -ml-0.5 h-[calc(100vh-4.5rem)] overflow-y-auto overflow-x-hidden py-16 pl-0.5"
            ref={parentRef}>
            <Navigation
              navigation={navigation}
              preserveScroll={preserveScroll}
              linkRef={linkRef}
              className="w-64 pr-8 xl:w-72 xl:pr-16"
            />
          </div>
        </div>
        <div className="min-w-0 max-w-2xl flex-auto px-4 py-16 lg:max-w-none lg:pl-8 lg:pr-0 xl:px-16">
          <article>
            {(meta.title || section) && (
              <header className="mb-9 space-y-1">
                {section && (
                  <p className="font-display text-brand-light dark:text-brand-dark text-sm font-medium">
                    {section.title}
                  </p>
                )}
                {meta.title && (
                  <h1 className="font-display text-3xl tracking-tight text-slate-800 dark:text-slate-100">
                    {meta.title}
                  </h1>
                )}
              </header>
            )}
            <Prose className="">{children}</Prose>
          </article>
          <DocsFeedback />
          <dl className="mt-12 flex border-t border-slate-200 pt-6 dark:border-slate-800">
            {previousPage && (
              <div>
                <dt className="font-display text-brand-dark dark:text-brand-light text-sm font-medium">
                  Previous
                </dt>
                <dd className="mt-1">
                  <Link
                    href={previousPage.href}
                    className="text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
                    <span aria-hidden="true">&larr;</span> {previousPage.title}
                  </Link>
                </dd>
              </div>
            )}
            {nextPage && (
              <div className="ml-auto text-right">
                <dt className="font-display text-brand-dark dark:text-brand-light text-sm font-medium">
                  Next
                </dt>
                <dd className="mt-1">
                  <Link
                    href={nextPage.href}
                    className="text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
                    {nextPage.title} <span aria-hidden="true">&rarr;</span>
                  </Link>
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-16 rounded-xl border-2 border-slate-200 bg-slate-300 p-8 dark:border-slate-700/50 dark:bg-slate-800">
            <h4 className="text-3xl font-semibold text-slate-500 dark:text-slate-50">Need help? 🤓</h4>
            <p className="my-4 text-slate-500 dark:text-slate-400">
              Join our Discord and ask away. We&apos;re happy to help where we can!
            </p>
            <Button variant="highlight" href="/discord" target="_blank">
              Join Discord
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
