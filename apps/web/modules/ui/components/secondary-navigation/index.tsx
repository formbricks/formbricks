import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

interface TSecondaryNavItem {
  id: string;
  label: React.ReactNode;
  href?: string;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  hidden?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
}

interface SecondaryNavbarProps {
  navigation: TSecondaryNavItem[];
  activeId: string;
  loading?: boolean;
  /**
   * "tabs" (default) renders items side by side. "steps" renders them as a
   * step-by-step guide with chevron separators between items (wizard style).
   */
  variant?: "tabs" | "steps";
}

const getTabTextClassName = (isActive: boolean) =>
  cn(
    isActive ? "font-semibold text-slate-900" : "text-slate-500 hover:text-slate-700",
    "flex h-full items-center px-3 text-sm font-medium"
  );

const getTabIndicatorClassName = ({
  isActive,
  isDisabled,
  isLoading,
}: {
  isActive: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
}) => {
  if (isDisabled) {
    return "bg-transparent";
  }

  if (isActive) {
    return isLoading ? "bg-slate-300" : "bg-brand-dark";
  }

  return "bg-transparent group-hover:bg-slate-300";
};

const renderDisabledNavItem = (navElem: TSecondaryNavItem) =>
  navElem.disabledMessage ? (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-disabled="true"
          className="flex h-full cursor-not-allowed items-center px-3 text-sm font-medium text-slate-400">
          {navElem.label}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-fit max-w-72 px-3 py-2 text-sm text-slate-700">
        {navElem.disabledMessage}
      </PopoverContent>
    </Popover>
  ) : (
    <button
      type="button"
      aria-disabled="true"
      className="flex h-full cursor-not-allowed items-center px-3 text-sm font-medium text-slate-400">
      {navElem.label}
    </button>
  );

const renderInteractiveNavItem = (navElem: TSecondaryNavItem, activeId: string) => {
  const textClassName = getTabTextClassName(navElem.id === activeId);

  if (navElem.href) {
    return (
      <Link
        href={navElem.href}
        {...(navElem.onClick ? { onClick: navElem.onClick } : {})}
        className={textClassName}
        aria-current={navElem.id === activeId ? "page" : undefined}>
        {navElem.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      {...(navElem.onClick ? { onClick: navElem.onClick } : {})}
      className={cn(textClassName, "grow transition-all duration-150 ease-in-out")}
      aria-current={navElem.id === activeId ? "page" : undefined}>
      {navElem.label}
    </button>
  );
};

export const SecondaryNavigation = ({
  navigation,
  activeId,
  loading,
  variant = "tabs",
  ...props
}: SecondaryNavbarProps) => {
  const visibleNavigation = navigation.filter((navElem) => !navElem.hidden);
  const isSteps = variant === "steps";

  const renderTab = (navElem: TSecondaryNavItem) => (
    <div className="group flex h-full flex-col truncate">
      {loading ? (
        <div
          aria-disabled="true"
          className={cn(
            navElem.id === activeId ? "font-semibold text-slate-900" : "text-slate-500",
            "flex h-full items-center truncate px-3 text-sm font-medium"
          )}
          aria-current={navElem.id === activeId ? "page" : undefined}>
          {navElem.label}
        </div>
      ) : navElem.disabled ? (
        renderDisabledNavItem(navElem)
      ) : (
        renderInteractiveNavItem(navElem, activeId)
      )}
      <div
        className={cn(
          "bottom-0 mt-auto h-[2px] w-full rounded-t-lg transition-all duration-150 ease-in-out",
          getTabIndicatorClassName({
            isActive: navElem.id === activeId,
            isDisabled: loading ? undefined : navElem.disabled,
            isLoading: loading,
          })
        )}
      />
    </div>
  );

  return (
    <div {...props}>
      <nav className={cn("flex h-10 w-full items-center", isSteps ? "gap-x-2" : "gap-x-4")} aria-label="Tabs">
        {visibleNavigation.map((navElem, index) => (
          <Fragment key={navElem.id}>
            {isSteps && index > 0 && (
              <ChevronRightIcon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            )}
            {renderTab(navElem)}
          </Fragment>
        ))}
      </nav>
    </div>
  );
};
