"use client";

import FBLogo from "@/images/formbricks-wordmark.svg";
import { cn } from "@/lib/cn";
import { capitalizeFirstLetter } from "@/lib/utils/strings";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";
import { useTranslate } from "@tolgee/react";
import { ArrowUpRightIcon, ChevronRightIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

interface LandingSidebarProps {
  isMultiOrgEnabled: boolean;
  user: TUser;
  organization: TOrganization;
  organizations: TOrganization[];
}

export const LandingSidebar = ({
  isMultiOrgEnabled,
  user,
  organization,
  organizations,
}: LandingSidebarProps) => {
  const [openCreateOrganizationModal, setOpenCreateOrganizationModal] = useState<boolean>(false);

  const { t } = useTranslate();

  const router = useRouter();

  const handleEnvironmentChangeByOrganization = (organizationId: string) => {
    router.push(`/organizations/${organizationId}/`);
  };

  const dropdownNavigation = [
    {
      label: t("common.documentation"),
      href: "https://formbricks.com/docs",
      target: "_blank",
      icon: ArrowUpRightIcon,
    },
  ];

  const currentOrganizationId = organization?.id;
  const currentOrganizationName = capitalizeFirstLetter(organization?.name);

  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((a, b) => a.name.localeCompare(b.name));
  }, [organizations]);

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
            className="w-full rounded-br-xl border-t py-4 pl-4 transition-colors duration-200 hover:bg-slate-50 focus:outline-none">
            <div tabIndex={0} className={cn("flex cursor-pointer flex-row items-center space-x-3")}>
              <ProfileAvatar userId={user.id} imageUrl={user.imageUrl} />
              <>
                <div>
                  <p
                    title={user?.email}
                    className={cn(
                      "ph-no-capture ph-no-capture -mb-0.5 max-w-28 truncate text-sm font-bold text-slate-700"
                    )}>
                    {user?.name ? <span>{user?.name}</span> : <span>{user?.email}</span>}
                  </p>
                  <p
                    title={capitalizeFirstLetter(organization?.name)}
                    className="max-w-28 truncate text-sm text-slate-500">
                    {capitalizeFirstLetter(organization?.name)}
                  </p>
                </div>
                <ChevronRightIcon className={cn("h-5 w-5 text-slate-700 hover:text-slate-500")} />
              </>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            id="userDropdownInnerContentWrapper"
            side="right"
            sideOffset={10}
            alignOffset={5}
            align="end">
            {/* Dropdown Items */}

            {dropdownNavigation.map((link) => (
              <Link id={link.href} href={link.href} target={link.target} className="flex w-full items-center">
                <DropdownMenuItem>
                  <link.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                  {link.label}
                </DropdownMenuItem>
              </Link>
            ))}

            {/* Logout */}

            <DropdownMenuItem
              onClick={async () => {
                await signOut({ callbackUrl: "/auth/login" });
              }}
              icon={<LogOutIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />}>
              {t("common.logout")}
            </DropdownMenuItem>

            {/* Organization Switch */}

            {(isMultiOrgEnabled || organizations.length > 1) && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="rounded-lg">
                  <div>
                    <p>{currentOrganizationName}</p>
                    <p className="block text-xs text-slate-500">{t("common.switch_organization")}</p>
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent sideOffset={10} alignOffset={5}>
                    <DropdownMenuRadioGroup
                      value={currentOrganizationId}
                      onValueChange={(organizationId) =>
                        handleEnvironmentChangeByOrganization(organizationId)
                      }>
                      {sortedOrganizations.map((organization) => (
                        <DropdownMenuRadioItem
                          value={organization.id}
                          className="cursor-pointer rounded-lg"
                          key={organization.id}>
                          {organization.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    {isMultiOrgEnabled && (
                      <DropdownMenuItem
                        onClick={() => setOpenCreateOrganizationModal(true)}
                        icon={<PlusIcon className="mr-2 h-4 w-4" />}>
                        <span>{t("common.create_new_organization")}</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CreateOrganizationModal open={openCreateOrganizationModal} setOpen={setOpenCreateOrganizationModal} />
    </aside>
  );
};
