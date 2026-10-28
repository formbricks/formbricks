"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { type ShellNavItem, isNavItemActive } from "../lib/nav-items";
import { NavIcon } from "./nav-icon";

interface ShellNavLinksProps {
  items: ShellNavItem[];
  organizationId: string;
  ariaLabel: string;
  onNavigate?: () => void;
}

export const ShellNavLinks = ({
  items,
  organizationId,
  ariaLabel,
  onNavigate,
}: Readonly<ShellNavLinksProps>) => {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = isNavItemActive(item, pathname, organizationId);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
              isActive && "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-white"
            )}>
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};
