"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";

interface MainNavigationHeaderProps {
  isCollapsed: boolean;
  // The 150ms delay that fades the wordmark out while the sidebar animates, so the text does not
  // jump before the panel has finished resizing.
  isTextVisible: boolean;
  homeHref: string;
  onToggle: () => void;
}

/**
 * The sidebar's top row: the Formbricks wordmark (expanded only) and the collapse/expand toggle.
 *
 * Split out of MainNavigation rather than inlined: the block branched on `isCollapsed` three times
 * and on `isTextVisible` once, all nested inside the JSX, which is where most of that component's
 * cognitive complexity sat (ENG-3076).
 */
export const MainNavigationHeader = ({
  isCollapsed,
  isTextVisible,
  homeHref,
  onToggle,
}: Readonly<MainNavigationHeaderProps>) => {
  const { t } = useTranslation();

  return (
    <div className={cn("flex items-center px-3 pb-4", isCollapsed ? "justify-center" : "justify-between")}>
      {!isCollapsed && (
        <Link
          href={homeHref}
          className={cn(
            "flex items-center justify-center transition-opacity duration-100",
            isTextVisible ? "opacity-0" : "opacity-100"
          )}>
          <Image src={FBLogo} width={160} height={30} alt={t("workspace.formbricks_logo")} />
        </Link>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className="rounded-xl bg-slate-50 p-1 text-slate-600 transition-all hover:bg-slate-100 focus:ring-0 focus:ring-transparent focus:outline-hidden">
        {isCollapsed ? <PanelLeftOpenIcon strokeWidth={1.5} /> : <PanelLeftCloseIcon strokeWidth={1.5} />}
      </Button>
    </div>
  );
};
