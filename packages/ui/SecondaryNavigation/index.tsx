import Link from "next/link";

import { cn } from "@formbricks/lib/cn";

interface SecondaryNavbarProps {
  navigation: { id: string; label: string; href: string; icon?: React.ReactNode; hidden?: boolean }[];
  activeId: string;
}

export const SecondaryNavigation = ({ navigation, activeId, ...props }: SecondaryNavbarProps) => {
  return (
    <div {...props}>
      <div className="grid h-10 w-full grid-cols-[auto,1fr] ">
        <nav className="flex h-full min-w-full items-center space-x-4" aria-label="Tabs">
          {navigation.map((navElem) => (
            <Link
              key={navElem.id}
              href={navElem.href}
              className={cn(
                navElem.id === activeId
                  ? "border-brand-dark border-b-2 font-semibold text-slate-900"
                  : "border-transparent text-slate-500 transition-all duration-150 ease-in-out hover:border-slate-300 hover:text-slate-700",
                "flex h-full items-center border-b-2 px-3 text-sm font-medium",
                navElem.hidden && "hidden"
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
