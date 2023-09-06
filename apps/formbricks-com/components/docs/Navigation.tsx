"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion, useIsPresent } from "framer-motion";

import { Button } from "./Button";
import { useIsInsideMobileNavigation } from "./MobileNavigation";
import { useSectionStore } from "./SectionProvider";
import { Tag } from "./Tag";
import { remToPx } from "@/lib/remToPx";

interface NavGroup {
  title: string;
  links: Array<{
    title: string;
    href: string;
  }>;
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
  tag,
  active = false,
  isAnchorLink = false,
}: {
  href: string;
  children: React.ReactNode;
  tag?: string;
  active?: boolean;
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
      {tag && (
        <Tag variant="small" color="slate">
          {tag}
        </Tag>
      )}
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
  let height = isPresent ? Math.max(1, visibleSections.length) * itemHeight : itemHeight;
  let top =
    group.links.findIndex((link) => link.href === pathname) * itemHeight +
    firstVisibleSectionIndex * itemHeight;

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
  let activePageIndex = group.links.findIndex((link) => link.href === pathname);
  let top = offset + activePageIndex * itemHeight;

  return (
    <motion.div
      layout
      className="absolute left-2 h-6 w-px bg-emerald-500"
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
  let [pathname, sections] = useInitialValue(
    [usePathname(), useSectionStore((s) => s.sections)],
    isInsideMobileNavigation
  );

  let isActiveGroup = group.links.findIndex((link) => link.href === pathname) !== -1;

  return (
    <li className={clsx("relative mt-6", className)}>
      <motion.h2 layout="position" className="text-xs font-semibold text-slate-900 dark:text-white">
        {group.title}
      </motion.h2>
      <div className="relative mt-3 pl-2">
        <AnimatePresence initial={!isInsideMobileNavigation}>
          {isActiveGroup && <VisibleSectionHighlight group={group} pathname={pathname || "/docs"} />}
        </AnimatePresence>
        <motion.div layout className="absolute inset-y-0 left-2 w-px bg-slate-900/10 dark:bg-white/5" />
        <AnimatePresence initial={false}>
          {isActiveGroup && <ActivePageMarker group={group} pathname={pathname || "/docs"} />}
        </AnimatePresence>
        <ul role="list" className="border-l border-transparent">
          {group.links.map((link) => (
            <motion.li key={link.href} layout="position" className="relative">
              <NavLink href={link.href} active={link.href === pathname}>
                {link.title}
              </NavLink>
              <AnimatePresence mode="popLayout" initial={false}>
                {link.href === pathname && sections.length > 0 && (
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
                    {sections.map((section) => (
                      <li key={section.id}>
                        <NavLink href={`${link.href}#${section.id}`} tag={section.tag} isAnchorLink>
                          {section.title}
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

export const navigation: Array<NavGroup> = [
  {
    title: "Introduction",
    links: [
      { title: "What is Formbricks?", href: "/docs/introduction/what-is-formbricks" },
      { title: "Why is it better?", href: "/docs/introduction/why-is-it-better" },
      { title: "How does it work?", href: "/docs/introduction/how-it-works" },
    ],
  },
  {
    title: "Getting Started",
    links: [
      { title: "Quickstart: In app", href: "/docs/getting-started/quickstart-in-app-survey" },
      { title: "Framework Guides", href: "/docs/getting-started/framework-guides" },
    ],
  },
  {
    title: "Attributes",
    links: [
      { title: "Why Attributes?", href: "/docs/attributes/why" },
      { title: "Custom Attributes", href: "/docs/attributes/custom-attributes" },
      { title: "Identify users", href: "/docs/attributes/identify-users" },
    ],
  },
  {
    title: "Actions",
    links: [
      { title: "Why Actions?", href: "/docs/actions/why" },
      { title: "No-Code Actions", href: "/docs/actions/no-code" },
      { title: "Code Actions", href: "/docs/actions/code" },
    ],
  },
  {
    title: "Best Practices",
    links: [
      { title: "Learn from Churn", href: "/docs/best-practices/cancel-subscription" },
      { title: "Interview Prompt", href: "/docs/best-practices/interview-prompt" },
      { title: "Product-Market Fit", href: "/docs/best-practices/pmf-survey" },
      { title: "Trial Conversion", href: "/docs/best-practices/improve-trial-cr" },
      { title: "Feature Chaser", href: "/docs/best-practices/feature-chaser" },
      { title: "Feedback Box", href: "/docs/best-practices/feedback-box" },
      { title: "Docs Feedback", href: "/docs/best-practices/docs-feedback" },
    ],
  },
  {
    title: "Integrations",
    links: [
      { title: "Zapier", href: "/docs/integrations/zapier" },
      { title: "n8n", href: "/docs/integrations/n8n" },
    ],
  },
  {
    title: "Link Surveys",
    links: [
      { title: "Data Prefilling", href: "/docs/link-surveys/data-prefilling" },
      { title: "User Identification", href: "/docs/link-surveys/user-identification" },
    ],
  },
  {
    title: "Self-hosting",
    links: [
      { title: "Deployment", href: "/docs/self-hosting/deployment" },
      { title: "Production", href: "/docs/self-hosting/production" },
      { title: "Docker", href: "/docs/self-hosting/docker" },
      { title: "From Source", href: "/docs/self-hosting/from-source" },
    ],
  },
  {
    title: "Contributing",
    links: [
      { title: "Introduction", href: "/docs/contributing/introduction" },
      { title: "Setup Dev Environment", href: "/docs/contributing/setup" },
      { title: "Demo App", href: "/docs/contributing/demo" },
      { title: "Troubleshooting", href: "/docs/contributing/troubleshooting" },
    ],
  },
  {
    title: "API",
    links: [
      { title: "Overview", href: "/docs/api/overview" },
      { title: "API Key Setup", href: "/docs/api/api-key-setup" },
      { title: "Displays", href: "/docs/api/display" },
      { title: "People", href: "/docs/api/people" },
      { title: "Responses", href: "/docs/api/responses" },
      { title: "Surveys", href: "/docs/api/surveys" },
      { title: "Webhook", href: "/docs/api/webhooks" },
    ],
  },
];

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
