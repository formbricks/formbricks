"use client";

import { formbricksLogout } from "@/app/lib/formbricks";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/modules/ui/components/dialog";
import { useLogout } from "@account-kit/react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useTranslate } from "@tolgee/react";
import {
  BlocksIcon,
  BookUserIcon,
  Cog,
  LogOutIcon,
  MessageCircle,
  SearchIcon,
  UserCircleIcon,
  WalletMinimalIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganization } from "@formbricks/types/organizations";
import { TUser } from "@formbricks/types/user";

interface MobileSidebarProps {
  environment: TEnvironment;
  organization: TOrganization;
  user: TUser;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  hasAccess: boolean;
}

export function MobileSidebar({
  environment,
  organization,
  user,
  isOpen,
  setIsOpen,
  hasAccess,
}: MobileSidebarProps) {
  const { t } = useTranslate();
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useLogout({});

  const handleNavigation = (href: string) => {
    router.push(href);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    const route = await signOut({ redirect: false, callbackUrl: "/auth/login" });
    router.push(route.url);
    await formbricksLogout();
  };

  const mainNavigation = [
    {
      name: t("common.discover"),
      href: `/environments/${environment.id}/discover`,
      icon: SearchIcon,
      isActive: pathname?.includes("/discover"),
    },
    {
      name: t("common.surveys"),
      href: `/environments/${environment.id}/engagements`,
      icon: MessageCircle,
      isActive: pathname?.includes("/engagements"),
    },
    {
      name: t("common.wallet"),
      href: `/environments/${environment.id}/wallet`,
      icon: WalletMinimalIcon,
      isActive: pathname?.includes("/wallet"),
    },
    {
      name: t("common.communities"),
      href: `/environments/${environment.id}/communities`,
      icon: BookUserIcon,
      isActive: pathname?.includes("/communities"),
    },
    ...(hasAccess
      ? [
          {
            name: t("common.integrations"),
            href: `/environments/${environment.id}/integrations`,
            icon: BlocksIcon,
            isActive: pathname?.includes("/integrations"),
          },
          {
            name: t("common.configuration"),
            href: `/environments/${environment.id}/project/general`,
            icon: Cog,
            isActive: pathname?.includes("/project"),
          },
        ]
      : []),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="fixed right-0 h-full bg-slate-50 px-3 py-2 shadow-xl" hideCloseButton={false}>
        <VisuallyHidden>
          <DialogTitle></DialogTitle>
          <DialogDescription></DialogDescription>
        </VisuallyHidden>
        <div className="flex h-full flex-col overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-8">
            <div className="flex items-center gap-2">
              <ProfileAvatar userId={user.id} imageUrl={user.imageUrl} />
              <div>
                <div className="max-w-[80px] truncate text-sm font-semibold text-slate-700">
                  {user?.name || user?.email}
                </div>
                <div className="text-xs text-slate-500">{organization?.name}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-1 px-2">
              {mainNavigation.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "flex w-full items-center gap-3 py-2 text-sm font-medium",
                    item.isActive ? "text-slate-900" : "text-slate-600"
                  )}>
                  <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pb-2">
            <button
              onClick={() => handleNavigation(`/environments/${environment.id}/settings/profile`)}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700">
              <UserCircleIcon className="h-5 w-5" strokeWidth={1.5} />
              {t("common.account")}
            </button>

            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700">
              <LogOutIcon className="h-5 w-5" strokeWidth={1.5} />
              {t("common.logout")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
