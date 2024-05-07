"use client";

import clsx from "clsx";
import {
  BellRingIcon,
  BoltIcon,
  CreditCardIcon,
  FileSearch2Icon,
  LinkIcon,
  UserCircleIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { FaDiscord } from "react-icons/fa6";

import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { truncate } from "@formbricks/lib/strings";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TTeam } from "@formbricks/types/teams";

interface SettingsNavbarProps {
  environmentId: string;
  isFormbricksCloud: boolean;
  team: TTeam;
  product: TProduct;
  membershipRole?: TMembershipRole;
  isMultiLanguageAllowed: boolean;
}

export default function SettingsNavbar({
  environmentId,
  isFormbricksCloud,
  team,
  product,
  membershipRole,
  isMultiLanguageAllowed,
}: SettingsNavbarProps) {
  const pathname = usePathname();
  const { isAdmin, isOwner, isViewer } = getAccessFlags(membershipRole);
  const isPricingDisabled = !isOwner && !isAdmin;

  interface NavigationLink {
    name: string;
    href: string;
    icon: React.ComponentType<any>;
    current?: boolean;
    hidden: boolean;
    target?: string;
  }

  interface NavigationSection {
    title: string;
    links: NavigationLink[];
    hidden: boolean;
  }

  const navigation: NavigationSection[] = useMemo(
    () => [
      {
        title: "Account",
        links: [
          {
            name: "Profile",
            href: `/environments/${environmentId}/settings/profile`,
            icon: UserCircleIcon,
            current: pathname?.includes("/profile"),
            hidden: false,
          },
          {
            name: "Notifications",
            href: `/environments/${environmentId}/settings/notifications`,
            icon: BellRingIcon,
            current: pathname?.includes("/notifications"),
            hidden: false,
          },
        ],
        hidden: false,
      },
      {
        title: "Team",
        links: [
          {
            name: "Members",
            href: `/environments/${environmentId}/settings/members`,
            icon: UsersIcon,
            current: pathname?.includes("/members"),
            hidden: false,
          },
          {
            name: "Billing & Plan",
            href: `/environments/${environmentId}/settings/billing`,
            icon: CreditCardIcon,
            hidden: !isFormbricksCloud || isPricingDisabled,
            current: pathname?.includes("/billing"),
          },
          {
            name: "Enterprise License",
            href: `/environments/${environmentId}/settings/enterprise`,
            icon: BoltIcon,
            hidden: isFormbricksCloud || isPricingDisabled,
            current: pathname?.includes("/enterprise"),
          },
        ],
        hidden: false,
      },
      {
        title: "Links",
        links: [
          {
            name: "Documentation",
            href: "https://formbricks.com/docs",
            icon: FileSearch2Icon,
            target: "_blank",
            hidden: false,
          },
          {
            name: "Join Discord",
            href: "https://formbricks.com/discord",
            icon: FaDiscord,
            target: "_blank",
            hidden: false,
          },
        ],
        hidden: false,
      },
      {
        title: "Compliance",
        links: [
          {
            name: "GDPR & CCPA",
            href: "https://formbricks.com/gdpr",
            icon: LinkIcon,
            target: "_blank",
            hidden: !isFormbricksCloud,
          },
          {
            name: "Privacy",
            href: "https://formbricks.com/privacy",
            icon: LinkIcon,
            target: "_blank",
            hidden: !isFormbricksCloud,
          },
          {
            name: "Terms",
            href: "https://formbricks.com/terms",
            icon: LinkIcon,
            target: "_blank",
            hidden: !isFormbricksCloud,
          },
          {
            name: "License",
            href: "https://github.com/formbricks/formbricks/blob/main/LICENSE",
            icon: LinkIcon,
            target: "_blank",
            hidden: false,
          },
        ],
        hidden: false,
      },
    ],
    [environmentId, pathname, isViewer, isMultiLanguageAllowed, isFormbricksCloud, isPricingDisabled]
  );

  if (!navigation) return null;

  return (
    <>
      <div className="pl-6 pt-20">
        <nav className="flex-1 px-2">
          {navigation.map(
            (item) =>
              !item.hidden && (
                <div key={item.title}>
                  <p className="mt-6 pl-3 pr-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {item.title}{" "}
                    {item.title === "Product" && product?.name && (
                      <span className="font-normal capitalize">({truncate(product?.name, 10)})</span>
                    )}
                    {item.title === "Team" && team?.name && (
                      <span className="font-normal capitalize">({truncate(team?.name, 14)})</span>
                    )}
                  </p>
                  <div className="ml-2 mt-3 space-y-2">
                    {item.links
                      .filter((l) => !l.hidden)
                      .map((link) => (
                        <Link
                          key={link.name}
                          href={link.href}
                          target={link.target}
                          className={clsx(
                            link.current
                              ? "border-brand-dark  font-semibold text-slate-900"
                              : "border-transparent  hover:border-slate-300 ",
                            "group flex items-center whitespace-nowrap rounded-l-md border-r-2 px-4 py-2 pl-2 text-sm text-slate-600 hover:text-slate-900"
                          )}>
                          <link.icon
                            className="mr-3 h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-slate-500"
                            aria-hidden="true"
                          />
                          {link.name}
                        </Link>
                      ))}
                  </div>
                </div>
              )
          )}
        </nav>
      </div>
    </>
  );
}
