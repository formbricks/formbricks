"use client";

import VerticalNavigation from "@/app/(app)/environments/[environmentId]/components/VerticalNavigation";
import FBLogo from "@/images/Formbricks-wordmark.svg";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import type { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TTeam } from "@formbricks/types/teams";
import { Button } from "@formbricks/ui/Button";

interface SideBarProps {
  environment: TEnvironment;
  teams: TTeam[];
  session: Session;
  team: TTeam;
  products: TProduct[];
  environments: TEnvironment[];
  isFormbricksCloud: boolean;
  webAppUrl: string;
  membershipRole?: TMembershipRole;
  isMultiLanguageAllowed: boolean;
}

export default function SideBar({
  environment,
  teams,
  team,
  session,
  products,
  environments,
  isFormbricksCloud,
  webAppUrl,
  membershipRole,
  isMultiLanguageAllowed,
}: SideBarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTextVisible, setIsTextVisible] = useState(true);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  useEffect(() => {
    const toggleTextOpacity = () => {
      setIsTextVisible(isCollapsed ? true : false);
    };
    const timeoutId = setTimeout(toggleTextOpacity, 150);
    return () => clearTimeout(timeoutId);
  }, [isCollapsed]);

  if (pathname?.includes("/edit") || pathname?.includes("/surveys/templates")) return null;

  return (
    <div
      id="sidebar"
      className={cn(
        "relative z-50 transition-all duration-100",
        !isCollapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded"
      )}>
      {!isCollapsed && (
        <Link
          href={`/environments/${environment.id}/surveys/`}
          className={cn(
            "fixed flex items-center justify-center p-1 transition-opacity duration-100",
            isTextVisible ? "opacity-0" : "opacity-100"
          )}>
          <Image src={FBLogo} width={188} height={30} alt="Formbricks Logo" />
        </Link>
      )}
      <Button
        size="icon"
        tooltipSide="right"
        onClick={toggleSidebar}
        className={cn(
          "fixed top-2 z-50 rounded-xl border border-slate-200 bg-transparent p-1 text-slate-600 transition-all hover:bg-slate-100 focus:outline-none focus:ring-0 focus:ring-transparent",
          isCollapsed ? "ml-[1.7rem]" : "ml-[11.5rem]"
        )}>
        {isCollapsed ? <PanelLeftOpenIcon strokeWidth={1} /> : <PanelLeftCloseIcon strokeWidth={1} />}
      </Button>
      <VerticalNavigation
        isCollapsed={isCollapsed}
        isTextVisible={isTextVisible}
        environment={environment}
        team={team}
        teams={teams}
        products={products}
        environments={environments}
        session={session}
        isFormbricksCloud={isFormbricksCloud}
        webAppUrl={webAppUrl}
        membershipRole={membershipRole}
        isMultiLanguageAllowed={isMultiLanguageAllowed}
      />
    </div>
  );
}
