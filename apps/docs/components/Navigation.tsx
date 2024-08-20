"use client";

import { navigation } from "@/lib/navigation";
import { remToPx } from "@/lib/remToPx";
import clsx from "clsx";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
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

const useInitialValue = <T,>(value: T, condition = true) => {
  let initialValue = useRef(value).current;
  return condition ? initialValue : value;
};

const NavLink = ({
  href,
  children,
  active = false,
  isAnchorLink = false,
}: {
  href?: string;
  children: React.ReactNode;
  active: boolean;
  isAnchorLink?: boolean;
}) => {
  const commonClasses = clsx(
    "flex justify-between gap-2 py-1 pr-3 text-sm transition",
    isAnchorLink ? "pl-7" : "pl-4",
    active
      ? "rounded-r-md bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "flex justify-between gap-2 py-1 pr-3 text-sm transition",
          isAnchorLink ? "pl-7" : "pl-4",
          active
            ? "rounded-r-md bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        )}>
        <span className="flex w-full truncate">{children}</span>
      </Link>
    );
  } else {
    return (
      <div aria-current={active ? "page" : undefined} className={commonClasses}>
        <span className="flex w-full truncate">{children}</span>
      </div>
    );
  }
};

const VisibleSectionHighlight = ({ group, pathname }: { group: NavGroup; pathname: string }) => {
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
      className="absolute inset-x-0 top-0"
      style={{ height, top }}
    />
  );
};

const ActivePageMarker = ({ group, pathname }: { group: NavGroup; pathname: string }) => {
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
};

const NavigationGroup = ({
  group,
  className,
  activeGroup,
  setActiveGroup,
  openGroups,
  setOpenGroups,
  isMobile,
}: {
  group: NavGroup;
  className?: string;
  activeGroup: NavGroup | null;
  setActiveGroup: (group: NavGroup | null) => void;
  openGroups: string[];
  setOpenGroups: (groups: string[]) => void;
  isMobile: boolean;
}) => {
  const isInsideMobileNavigation = useIsInsideMobileNavigation();
  const pathname = usePathname();
  const isActiveGroup = activeGroup?.title === group.title;

  const toggleParentTitle = (title: string) => {
    if (openGroups.includes(title)) {
      setOpenGroups(openGroups.filter((t) => t !== title));
    } else {
      setOpenGroups([...openGroups, title]);
    }
    setActiveGroup(group);
  };

  const isParentOpen = (title: string) => openGroups.includes(title);

  const sortedLinks = group.links.map((link) => {
    if (link.children) {
      link.children.sort((a, b) => a.title.localeCompare(b.title));
    }
    return link;
  });

  return (
    <li className={clsx("relative mt-6", className)}>
      <motion.h2 layout="position" className="font-semibold text-slate-900 dark:text-white">
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
          {sortedLinks.map((link) => (
            <motion.li key={link.title} layout="position" className="relative">
              {link.href ? (
                <NavLink
                  href={isMobile && link.children ? "" : link.href}
                  active={!!pathname?.startsWith(link.href)}>
                  {link.title}
                </NavLink>
              ) : (
                <div onClick={() => toggleParentTitle(link.title)}>
                  <NavLink
                    href={!isMobile ? link.children?.[0]?.href || "" : undefined}
                    active={
                      !!(
                        isParentOpen(link.title) &&
                        link.children &&
                        link.children.some((child) => pathname.startsWith(child.href))
                      )
                    }>
                    <span className="flex w-full justify-between">
                      {link.title}
                      {isParentOpen(link.title) ? (
                        <ChevronUpIcon className="my-1 h-4" />
                      ) : (
                        <ChevronDownIcon className="my-1 h-4" />
                      )}
                    </span>
                  </NavLink>
                </div>
              )}
              <AnimatePresence mode="popLayout" initial={false}>
                {isActiveGroup && link.children && isParentOpen(link.title) && (
                  <motion.ul
                    role="list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: 0.1 } }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}>
                    {link.children.map((child) => (
                      <li key={child.href}>
                        <NavLink href={child.href} isAnchorLink active={!!pathname?.startsWith(child.href)}>
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
};

interface NavigationProps extends React.ComponentPropsWithoutRef<"nav"> {
  isMobile: boolean;
}

export const Navigation = ({ isMobile, ...props }: NavigationProps) => {
  const [activeGroup, setActiveGroup] = useState<NavGroup | null>(navigation[0]);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  return (
    <nav {...props}>
      <ul role="list">
        {navigation.map((group, groupIndex) => (
          <NavigationGroup
            key={group.title}
            group={group}
            className={groupIndex === 0 ? "md:mt-0" : ""}
            activeGroup={activeGroup}
            setActiveGroup={setActiveGroup}
            openGroups={openGroups}
            setOpenGroups={setOpenGroups}
            isMobile={isMobile}
          />
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
};
