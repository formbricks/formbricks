import Link from "next/link";
import { cn } from "@formbricks/lib/cn";

interface SecondaryNavbarProps {
  navigation: {
    id: string;
    label: string;
    href?: string;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    hidden?: boolean;
  }[];
  activeId: string;
  loading?: boolean;
}

export const SecondaryNavigation = ({ navigation, activeId, loading, ...props }: SecondaryNavbarProps) => {
  return (
    <div {...props}>
      <div className="grid h-10 w-full grid-cols-[auto,1fr]">
        <nav className="flex h-full min-w-full items-center space-x-4" aria-label="Tabs">
          {loading
            ? navigation.map((navElem) => (
                <div className="group flex h-full flex-col" key={navElem.id}>
                  <div
                    aria-disabled="true"
                    className={cn(
                      navElem.id === activeId ? "font-semibold text-slate-900" : "text-slate-500",
                      "flex h-full items-center px-3 text-sm font-medium",
                      navElem.hidden && "hidden"
                    )}
                    aria-current={navElem.id === activeId ? "page" : undefined}>
                    {navElem.label}
                  </div>
                  <div
                    className={cn(
                      "bottom-0 mt-auto h-[2px] w-full rounded-t-lg transition-all duration-150 ease-in-out",
                      navElem.id === activeId ? "bg-slate-300" : "bg-transparent group-hover:bg-slate-300",
                      navElem.hidden && "hidden"
                    )}
                  />
                </div>
              ))
            : navigation.map(
                (navElem) =>
                  !navElem.hidden && (
                    <div className="group flex h-full flex-col" key={navElem.id}>
                      {navElem.href ? (
                        <Link
                          href={navElem.href}
                          {...(navElem.onClick ? { onClick: navElem.onClick } : {})}
                          className={cn(
                            navElem.id === activeId
                              ? "font-semibold text-slate-900"
                              : "text-slate-500 hover:text-slate-700",
                            "flex h-full items-center px-3 text-sm font-medium",
                            navElem.hidden && "hidden"
                          )}
                          aria-current={navElem.id === activeId ? "page" : undefined}>
                          {navElem.label}
                        </Link>
                      ) : (
                        <button
                          {...(navElem.onClick ? { onClick: navElem.onClick } : {})}
                          className={cn(
                            navElem.id === activeId
                              ? "font-semibold text-slate-900"
                              : "text-slate-500 hover:text-slate-700",
                            "grow items-center px-3 text-sm font-medium transition-all duration-150 ease-in-out",
                            navElem.hidden && "hidden"
                          )}
                          aria-current={navElem.id === activeId ? "page" : undefined}>
                          {navElem.label}
                        </button>
                      )}
                      <div
                        className={cn(
                          "bottom-0 mt-auto h-[2px] w-full rounded-t-lg transition-all duration-150 ease-in-out",
                          navElem.id === activeId
                            ? "bg-brand-dark"
                            : "bg-transparent group-hover:bg-slate-300",
                          navElem.hidden && "hidden"
                        )}
                      />
                    </div>
                  )
              )}
        </nav>
        <div className="justify-self-end"></div>
      </div>
    </div>
  );
};
