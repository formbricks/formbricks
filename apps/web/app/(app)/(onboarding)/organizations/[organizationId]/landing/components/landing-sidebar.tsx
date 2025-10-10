"use client";

import { ArrowUpRightIcon, ChevronRightIcon, LogOutIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { cn } from "@/lib/cn";
import { useSignOut } from "@/modules/auth/hooks/use-sign-out";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

interface LandingSidebarProps {
  user: TUser;
  organization: TOrganization;
}

export const LandingSidebar = ({ user, organization }: LandingSidebarProps) => {
  const [openCreateOrganizationModal, setOpenCreateOrganizationModal] = useState<boolean>(false);

  const { t } = useTranslation();
  const { signOut: signOutWithAudit } = useSignOut({ id: user.id, email: user.email });

  const dropdownNavigation = [
    {
      label: t("common.documentation"),
      href: "https://formbricks.com/docs",
      target: "_blank",
      icon: ArrowUpRightIcon,
    },
  ];

  return (
    <aside
      className={cn(
        "w-sidebar-collapsed z-40 flex flex-col justify-between rounded-r-xl border-r border-slate-200 bg-white pt-3 shadow-md transition-all duration-100"
      )}>
      <Image src={FBLogo} width={160} height={30} alt={t("environments.formbricks_logo")} />

      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            asChild
            id="userDropdownTrigger"
            className="w-full rounded-br-xl border-t p-4 transition-colors duration-200 hover:bg-slate-50 focus:outline-none">
            <button
              type="button"
              className={cn("flex w-full cursor-pointer flex-row items-center gap-3 text-left")}
              aria-haspopup="menu">
              <ProfileAvatar userId={user.id} />
              <div className="grow overflow-hidden">
                <p
                  title={user?.email}
                  className={cn(
                    "ph-no-capture ph-no-capture -mb-0.5 truncate text-sm font-bold text-slate-700"
                  )}>
                  {user?.name ? <span>{user?.name}</span> : <span>{user?.email}</span>}
                </p>
                <p title={organization?.name} className="truncate text-sm text-slate-500">
                  {organization?.name}
                </p>
              </div>
              <ChevronRightIcon className={cn("h-5 w-5 shrink-0 text-slate-700 hover:text-slate-500")} />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            id="userDropdownInnerContentWrapper"
            side="right"
            sideOffset={10}
            alignOffset={5}
            align="end">
            {/* Dropdown Items */}

            {dropdownNavigation.map((link) => (
              <Link
                key={link.href}
                id={link.href}
                href={link.href}
                target={link.target}
                rel={link.target === "_blank" ? "noopener noreferrer" : undefined}
                className="flex w-full items-center">
                <DropdownMenuItem>
                  <link.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  {link.label}
                </DropdownMenuItem>
              </Link>
            ))}

            {/* Logout */}
            <DropdownMenuItem
              onClick={async () => {
                await signOutWithAudit({
                  reason: "user_initiated",
                  redirectUrl: "/auth/login",
                  organizationId: organization.id,
                  redirect: true,
                  callbackUrl: "/auth/login",
                  clearEnvironmentId: true,
                });
              }}
              icon={<LogOutIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />}>
              {t("common.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CreateOrganizationModal open={openCreateOrganizationModal} setOpen={setOpenCreateOrganizationModal} />
    </aside>
  );
};
