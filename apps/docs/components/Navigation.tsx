"use client";

import { navigation } from "@/lib/navigation";
import { remToPx } from "@/lib/remToPx";
import clsx from "clsx";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

import { Button } from "./Button";
import { useIsInsideMobileNavigation } from "./MobileNavigation";
import { useSectionStore } from "./SectionProvider";

export interface BaseLink {
  title: string;
}

export interface LinkWithHref extends BaseLink {
  href: string;
  children?: never; // Ensure that 'children' cannot coexist with 'href'
}

export interface LinkWithChildren extends BaseLink {
  href?: never; // Ensure that 'href' cannot coexist with 'children'
  children: Array<{
    title: string;
    href: string;
  }>;
}

export interface NavGroup {
  title: string;
  links: Array<LinkWithHref | LinkWithChildren>;
}

function useInitialValue<T>(value: T, condition = true) {
  let initialValue = useRef(value).current;
  return condition ? initialValue : value;
}

function TopLevelNavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li className="md:hidden">
      <Link
        href={href}
        className="block py-1 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        {children}
      </Link>
    </li>
  );
}

function NavLink({
  href,
  children,
  active = false,
  isAnchorLink = false,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
  isAnchorLink?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex justify-between gap-2 py-1 pr-3 text-sm transition",
        isAnchorLink ? "pl-7" : "pl-4",
        active
          ? "text-slate-900 dark:text-white"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      )}>
      <span className="truncate">{children}</span>
    </Link>
  );
}

function VisibleSectionHighlight({ group, pathname }: { group: NavGroup; pathname: string }) {
  let [sections, visibleSections] = useInitialValue(
    [useSectionStore((s) => s.sections), useSectionStore((s) => s.visibleSections)],
    useIsInsideMobileNavigation()
  );

  let isPresent = useIsPresent();
  let firstVisibleSectionIndex = Math.max(
    0,
    [{ id: "_top" }, ...sections].findIndex((section) => section.id === visibleSections[0])
  );
  let itemHeight = remToPx(2);
  let activePageIndex = group.links.findIndex(
    (link) =>
      (link.href && pathname.startsWith(link.href)) ||
      (link.children && link.children.some((child) => pathname.startsWith(child.href)))
  );

  let height = isPresent ? Math.max(1, visibleSections.length) * itemHeight : itemHeight;
  let top = activePageIndex * itemHeight + firstVisibleSectionIndex * itemHeight;
  if (activePageIndex === -1) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.2 } }}
      exit={{ opacity: 0 }}
      className="bg-slate-800/2.5 dark:bg-white/2.5 absolute inset-x-0 top-0 will-change-transform"
      style={{ borderRadius: 8, height, top }}
    />
  );
}

function ActivePageMarker({ group, pathname }: { group: NavGroup; pathname: string }) {
  let itemHeight = remToPx(2);
  let offset = remToPx(0.25);
  let activePageIndex = group.links.findIndex(
    (link) =>
      (link.href && pathname.startsWith(link.href)) ||
      (link.children && link.children.some((child) => pathname.startsWith(child.href)))
  );
  if (activePageIndex === -1) return null;
  let top = offset + activePageIndex * itemHeight;

  return (
    <motion.div
      layout
      className="absolute left-2 h-6 w-px bg-teal-500"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { delay: 0.2 } }}
      exit={{ opacity: 0 }}
      style={{ top }}
    />
  );
}
function NavigationGroup({ group, className }: { group: NavGroup; className?: string }) {
  // If this is the mobile navigation then we always render the initial
  // state, so that the state does not change during the close animation.
  // The state will still update when we re-open (re-render) the navigation.
  let isInsideMobileNavigation = useIsInsideMobileNavigation();
  let [pathname] = useInitialValue([usePathname()], isInsideMobileNavigation);
  const isActiveGroup = group.links.some(
    (link) =>
      pathname.startsWith(link.href || "") ||
      (link.children && link.children.some((child) => pathname.startsWith(child.href)))
  );

  const activeParentTitle = group.links.find((link) =>
    link.children
      ? link.children.some((child) => pathname.startsWith(child.href))
      : pathname.startsWith(link.href || "")
  )?.title;

  return (
    <li className={clsx("relative mt-6", className)}>
      <motion.h2 layout="position" className="text-xs font-semibold text-slate-900 dark:text-white">
        {group.title}
      </motion.h2>
      <div className="relative mt-3 pl-2">
        <AnimatePresence initial={!isInsideMobileNavigation}>
          {isActiveGroup && <VisibleSectionHighlight group={group} pathname={pathname} />}
        </AnimatePresence>
        <motion.div layout className="absolute inset-y-0 left-2 w-px bg-slate-900/10 dark:bg-white/5" />
        <AnimatePresence initial={false}>
          {isActiveGroup && <ActivePageMarker group={group} pathname={pathname || "/docs"} />}
        </AnimatePresence>
        <ul role="list" className="border-l border-transparent">
          {group.links.map((link) => (
            <motion.li key={link.title} layout="position" className="relative">
              {link.href ? (
                <NavLink href={link.href} active={pathname.startsWith(link.href)}>
                  {link.title}
                </NavLink>
              ) : (
                <NavLink
                  href={link.children?.[0]?.href || ""}
                  active={
                    (link.children && link.children.some((child) => pathname.startsWith(child.href))) || false
                  }>
                  {link.title}
                </NavLink>
              )}
              <AnimatePresence mode="popLayout" initial={false}>
                {link.children && link.title === activeParentTitle && (
                  <motion.ul
                    role="list"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: { delay: 0.1 },
                    }}
                    exit={{
                      opacity: 0,
                      transition: { duration: 0.15 },
                    }}>
                    {link.children.map((child) => (
                      <li key={child.href}>
                        <NavLink href={child.href} isAnchorLink active={pathname.startsWith(child.href)}>
                          {child.title}
                        </NavLink>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export function Navigation(props: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav {...props}>
      <ul role="list">
        <TopLevelNavItem href="/docs/introduction/what-is-formbricks">Documentation</TopLevelNavItem>
        <TopLevelNavItem href="https://github.com/formbricks/formbricks">Star us on GitHub</TopLevelNavItem>
        <TopLevelNavItem href="https://formbricks.com/discord">Join our Discord</TopLevelNavItem>
        {navigation.map((group, groupIndex) => (
          <NavigationGroup key={group.title} group={group} className={groupIndex === 0 ? "md:mt-0" : ""} />
        ))}
        <li className="sticky bottom-0 z-10 mt-6 min-[416px]:hidden">
          <Button
            href="https://app.formbricks.com/auth/signup"
            target="_blank"
            variant="filled"
            className="w-full">
            Get Started
          </Button>
        </li>
      </ul>
    </nav>
  );
}
