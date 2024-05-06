import Link from "next/link";
import { ReactNode } from "react";

import { cn } from "@formbricks/lib/cn";

interface NavigationLinkProps {
  href: string;
  children: ReactNode;
  isActive: boolean;
  isCollapsed: boolean;
}

export default function NavigationLink({
  href,
  children,
  isActive,
  isCollapsed = false,
}: NavigationLinkProps) {
  const activeClass = "bg-slate-50 border-r-4 border-brand-dark font-semibold";
  const inactiveClass = "hover:bg-slate-50 border-r-4 border-transparent";

  return (
    <li
      className={cn(
        "my-1 ml-4 rounded-l-md py-2 text-sm text-slate-700 hover:text-slate-900",
        isActive ? activeClass : inactiveClass,
        isCollapsed ? "pl-1" : "pl-5"
      )}>
      <Link href={href} className="flex items-center">
        {children}
      </Link>
    </li>
  );
}
