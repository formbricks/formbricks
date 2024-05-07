"use client";

import clsx from "clsx";
import Link from "next/link";

interface NavigationLink {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  current?: boolean;
  hidden?: boolean;
  target?: string;
}

interface SecondNavigationProps {
  navigation: NavigationLink[];
}

export default function SecondNavigation({ navigation }: SecondNavigationProps) {
  if (!navigation) return null;

  return (
    <div className="fixed h-screen pl-6 pt-20">
      <nav className="flex-1 space-y-2 px-2">
        {navigation.map(
          (link) =>
            !link.hidden && (
              <Link
                key={link.id}
                href={link.href}
                target={link.target}
                className={clsx(
                  link.current
                    ? "border-brand-dark font-semibold text-slate-900"
                    : "border-transparent hover:border-slate-300 ",
                  "group flex items-center whitespace-nowrap rounded-l-md border-r-2 px-4 py-2 pl-2 text-sm text-slate-600 hover:text-slate-900"
                )}>
                {link.icon}
                <span className="ml-3">{link.label}</span>
              </Link>
            )
        )}
      </nav>
    </div>
  );
}
