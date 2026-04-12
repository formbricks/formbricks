"use client";

import { FoldersIcon, UserCircleIcon } from "lucide-react";
import { ArrowLeftIcon, BuildingIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { cn } from "@/lib/cn";
import {
  getAccountNavItems,
  getOrganizationNavItems,
  getWorkspaceNavItems,
} from "../lib/settings-nav-config";

interface SettingsSidebarProps {
  environmentId: string;
  projectName: string;
  organizationName: string;
  isFormbricksCloud: boolean;
  membershipRole?: TOrganizationRole;
}

interface NavItemProps {
  href: string;
  label: string;
  isActive: boolean;
  disabled?: boolean;
  disabledMessage?: string;
}

const NavItem = ({ href, label, isActive, disabled, disabledMessage }: NavItemProps) => {
  const { t } = useTranslation();

  if (disabled) {
    return (
      <span
        title={disabledMessage ? t(disabledMessage) : undefined}
        className="flex cursor-not-allowed items-center rounded-md px-3 py-1.5 text-sm text-slate-400">
        {t(label)}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center rounded-md px-3 py-1.5 text-sm transition-colors",
        "border-l-2 rtl:border-l-0 rtl:border-r-2",
        isActive
          ? "border-slate-900 bg-slate-100 font-medium text-slate-900"
          : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}>
      {t(label)}
    </Link>
  );
};

export const SettingsSidebar = ({
  environmentId,
  projectName,
  organizationName,
  isFormbricksCloud,
  membershipRole,
}: SettingsSidebarProps) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const workspaceItems = getWorkspaceNavItems({ environmentId });
  const organizationItems = getOrganizationNavItems({ environmentId, isFormbricksCloud, membershipRole });
  const accountItems = getAccountNavItems({ environmentId });

  const isActive = (href: string) => {
    const settingsBase = `/environments/${environmentId}/settings/`;
    if (!pathname?.startsWith(settingsBase)) return false;
    const relative = pathname.slice(settingsBase.length);
    const itemRelative = href.slice(settingsBase.length);
    return relative === itemRelative || relative.startsWith(itemRelative + "/");
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-e border-slate-200 bg-white rtl:border-e-0 rtl:border-s">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label={t("common.back")}
          className="flex items-center gap-2 rounded-md p-1 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
          <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" strokeWidth={1.5} />
          <span>{t("common.back")}</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Workspace section */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 px-3">
            <FoldersIcon className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("common.workspace")}
            </span>
            <span className="ms-auto max-w-[100px] truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {projectName}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {workspaceItems.map((item) => (
              <NavItem
                key={item.id}
                href={item.href}
                label={item.label}
                isActive={isActive(item.href)}
                disabled={item.disabled}
                disabledMessage={item.disabledMessage}
              />
            ))}
          </div>
        </div>

        {/* Organization section */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 px-3">
            <BuildingIcon className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("common.organization")}
            </span>
            <span className="ms-auto max-w-[100px] truncate rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {organizationName}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {organizationItems
              .filter((item) => !item.hidden)
              .map((item) => (
                <NavItem
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  isActive={isActive(item.href)}
                  disabled={item.disabled}
                  disabledMessage={item.disabledMessage}
                />
              ))}
          </div>
        </div>

        {/* Account section */}
        <div className="mb-6">
          <div className="mb-2 flex items-center gap-2 px-3">
            <UserCircleIcon className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t("common.account")}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {accountItems.map((item) => (
              <NavItem key={item.id} href={item.href} label={item.label} isActive={isActive(item.href)} />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
};
