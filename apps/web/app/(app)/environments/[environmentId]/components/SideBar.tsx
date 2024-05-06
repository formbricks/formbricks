"use client";

import VerticalNavigation from "@/app/(app)/environments/[environmentId]/components/VerticalNavigation";
import FBLogo from "@/images/Formbricks-wordmark.svg";
import type { Session } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TTeam } from "@formbricks/types/teams";

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

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  if (pathname?.includes("/edit") || pathname?.includes("/surveys/templates")) return null;

  return (
    <div id="sidebar" className={cn(!isCollapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded")}>
      <Link
        href={`/environments/${environment.id}/surveys/`}
        className="fixed flex items-center justify-center p-1">
        <Image src={FBLogo} width={188} height={30} alt="Formbricks wordmark" />
      </Link>
      <button
        onClick={toggleSidebar}
        className="fixed right-0 top-0 z-50 rounded-l-md bg-slate-800 p-4 text-white">
        {isCollapsed ? "☰" : "✕"}
      </button>
      <VerticalNavigation
        isCollapsed={isCollapsed}
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
