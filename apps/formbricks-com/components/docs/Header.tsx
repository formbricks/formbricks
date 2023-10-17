"use client";

import clsx from "clsx";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { forwardRef } from "react";

import { FooterLogo } from "@/components/shared/Logo";
import { Button } from "./Button";
import { MobileNavigation, useIsInsideMobileNavigation, useMobileNavigationStore } from "./MobileNavigation";
import { MobileSearch, Search } from "./Search";
import { ThemeToggle } from "./ThemeToggle";

function TopLevelNavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm leading-5 text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        {children}
      </Link>
    </li>
  );
}

export const Header = forwardRef<React.ElementRef<"div">, { className?: string }>(function Header(
  { className },
  ref
) {
  let { isOpen: mobileNavIsOpen } = useMobileNavigationStore();
  let isInsideMobileNavigation = useIsInsideMobileNavigation();

  let { scrollY } = useScroll();
  let bgOpacityLight = useTransform(scrollY, [0, 72], [0.5, 0.9]);
  let bgOpacityDark = useTransform(scrollY, [0, 72], [0.2, 0.8]);

  return (
    <motion.div
      ref={ref}
      className={clsx(
        className,
        "fixed inset-x-0 top-0 z-50 flex h-20 items-center justify-between gap-12 px-4 transition sm:px-6 lg:left-72 lg:z-30 lg:px-8 xl:left-80",
        !isInsideMobileNavigation && "backdrop-blur-sm dark:backdrop-blur lg:left-72 xl:left-80",
        isInsideMobileNavigation
          ? "bg-white dark:bg-slate-900"
          : "bg-white/[var(--bg-opacity-light)] dark:bg-slate-900/[var(--bg-opacity-dark)]"
      )}
      style={
        {
          "--bg-opacity-light": bgOpacityLight,
          "--bg-opacity-dark": bgOpacityDark,
        } as React.CSSProperties
      }>
      <div
        className={clsx(
          "absolute inset-x-0 top-full h-px transition",
          (isInsideMobileNavigation || !mobileNavIsOpen) && "bg-slate-900/7.5 dark:bg-white/7.5"
        )}
      />
      <Search />
      <div className="flex items-center gap-5 lg:hidden">
        <MobileNavigation />
        <Link href="/" aria-label="Home">
          <FooterLogo className="h-8" />
        </Link>
      </div>
      <div className="flex items-center gap-6">
        <nav className="hidden lg:block">
          <ul role="list" className="flex items-center gap-8">
            <TopLevelNavItem href="https://github.com/formbricks/formbricks">
              Star us on GitHub
            </TopLevelNavItem>
            <TopLevelNavItem href="https://formbricks.com/discord">Join our Discord</TopLevelNavItem>
          </ul>
        </nav>
        <div className="md:dark:bg-white/15 hidden md:block md:h-5 md:w-px md:bg-slate-900/10" />
        <div className="flex gap-4">
          <MobileSearch />
          <ThemeToggle />
        </div>
        <div className="hidden min-[416px]:contents">
          <Button href="https://app.formbricks.com/auth/signup" target="_blank" className="w-max">
            Get Started
          </Button>
        </div>
      </div>
    </motion.div>
  );
});
