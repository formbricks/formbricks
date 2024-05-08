import Link from "next/link";

import { cn } from "@formbricks/lib/cn";

interface SecondNavbarProps {
  navigation: { id: string; label: string; href: string; icon?: React.ReactNode }[];
  activeId: string;
}

export const SecondaryNavigation = ({ navigation, activeId, ...props }: SecondNavbarProps) => {
  return (
    <div {...props}>
      <div className="grid h-10 w-full grid-cols-3 justify-items-stretch">
        <nav className="flex h-full items-center space-x-4 " aria-label="Tabs">
          {navigation.map((navElem) => (
            <Link
              key={navElem.id}
              href={navElem.href}
              className={cn(
                navElem.id === activeId
                  ? " border-brand-dark border-b-2 font-semibold text-slate-900"
                  : "text-slate-500 hover:text-slate-700",
                "flex h-full items-center px-3 text-sm font-medium"
              )}
              aria-current={navElem.id === activeId ? "page" : undefined}>
              {navElem.label}
            </Link>
          ))}
        </nav>
        <div className="justify-self-end"></div>
      </div>
    </div>
  );
};
