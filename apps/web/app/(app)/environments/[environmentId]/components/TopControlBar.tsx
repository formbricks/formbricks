"use client";

import { MobileSidebar } from "@/app/(app)/environments/[environmentId]/components/MobileSidebar";
import FBLogo from "@/images/logo.svg";
import { useTranslate } from "@tolgee/react";
import { MenuIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

interface TopControlBarProps {
  environment: TEnvironment;
  environments: TEnvironment[];
  organization: TOrganization;
  user: TUser;
  hasAccess: boolean;
}

export const TopControlBar = ({ environment, organization, user, hasAccess }: TopControlBarProps) => {
  const { t } = useTranslate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <div className="fixed top-0 z-20 w-full bg-slate-50 shadow-sm">
        <div className="flex h-14 items-center justify-between px-3">
          <Link href={`/environments/${environment.id}/discover`}>
            <Image src={FBLogo} width={143} height={42} alt={t("logo")} className="" />
          </Link>

          <button onClick={() => setMobileSidebarOpen(true)} className="ml-2 h-9 w-9 lg:hidden">
            <MenuIcon className="h-6 w-6 text-black" strokeWidth={2} />
          </button>
        </div>
      </div>

      <MobileSidebar
        environment={environment}
        organization={organization}
        user={user}
        isOpen={mobileSidebarOpen}
        setIsOpen={setMobileSidebarOpen}
        hasAccess={hasAccess}
      />
    </div>
  );
};
