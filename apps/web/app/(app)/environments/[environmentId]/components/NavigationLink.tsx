import Link from "next/link";
import { ReactNode } from "react";

interface NavigationLinkProps {
  href: string;
  children: ReactNode;
  isActive: boolean;
}

export default function NavigationLink({ href, children, isActive }: NavigationLinkProps) {
  const activeClass = "bg-slate-50 border-r-4 border-brand-dark font-semibold";
  const inactiveClass = "hover:bg-slate-50 border-r-4 border-transparent";

  return (
    <li
      className={`my-1 ml-4 rounded-l-md py-2 pl-5 text-sm text-slate-700 hover:text-slate-900 ${isActive ? activeClass : inactiveClass}`}>
      <Link href={href} className="flex items-center">
        {children}
      </Link>
    </li>
  );
}
