import Link from "next/link";
import { ReactNode } from "react";

interface ProjectNavItemProps {
  href: string;
  children: ReactNode;
  isActive: boolean;
}

export const ProjectNavItem = ({ href, children, isActive }: ProjectNavItemProps) => {
  const activeClass = "bg-slate-50 font-semibold";
  const inactiveClass = "hover:bg-slate-50";

  return (
    <li
      className={`mx-4 my-1 rounded-md border border-slate-200 px-4 py-4 text-sm text-slate-700 hover:text-slate-900 ${isActive ? activeClass : inactiveClass}`}>
      <Link href={href} className="flex items-center">
        {children}
      </Link>
    </li>
  );
};
