"use client";

import { useProduct } from "@/lib/products/products";
import { useTeam } from "@/lib/teams/teams";
import { truncate } from "@/lib/utils";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import {
  AdjustmentsVerticalIcon,
  BellAlertIcon,
  ChatBubbleLeftEllipsisIcon,
  CreditCardIcon,
  DocumentCheckIcon,
  DocumentMagnifyingGlassIcon,
  KeyIcon,
  LinkIcon,
  PaintBrushIcon,
  HashtagIcon,
  UserCircleIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

export default function SettingsNavbar({ environmentId }: { environmentId: string }) {
  const pathname = usePathname();
  const { team } = useTeam(environmentId);
  const { product } = useProduct(environmentId);
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
  }

  // Then, specify the type of the navigation array
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
            icon: BellAlertIcon,
            current: pathname?.includes("/notifications"),
            hidden: false,
          },
        ],
      },
      {
        title: "Product",
        links: [
          {
            name: "Settings",
            href: `/environments/${environmentId}/settings/product`,
            icon: AdjustmentsVerticalIcon,
            current: pathname?.includes("/product"),
            hidden: false,
          },
          {
            name: "Look & Feel",
            href: `/environments/${environmentId}/settings/lookandfeel`,
            icon: PaintBrushIcon,
            current: pathname?.includes("/lookandfeel"),
            hidden: false,
          },
          {
            name: "API Keys",
            href: `/environments/${environmentId}/settings/api-keys`,
            icon: KeyIcon,
            current: pathname?.includes("/api-keys"),
            hidden: false,
          },
          {
            name: "Tags",
            href: `/environments/${environmentId}/settings/tags`,
            icon: HashtagIcon,
            current: pathname?.includes("/tags"),
            hidden: false,
          },
        ],
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
            hidden: !IS_FORMBRICKS_CLOUD,
            current: pathname?.includes("/billing"),
          },
        ],
      },
      {
        title: "Setup",
        links: [
          {
            name: "Setup Checklist",
            href: `/environments/${environmentId}/settings/setup`,
            icon: DocumentCheckIcon,
            current: pathname?.includes("/setup"),
            hidden: false,
          },
          {
            name: "Documentation",
            href: "https://formbricks.com/docs",
            icon: DocumentMagnifyingGlassIcon,
            target: "_blank",
            hidden: false,
          },
          {
            name: "Join Discord",
            href: "https://formbricks.com/discord",
            icon: ChatBubbleLeftEllipsisIcon,
            target: "_blank",
            hidden: false,
          },
        ],
      },
      {
        title: "Compliance",
        links: [
          {
            name: "GDPR & CCPA",
            href: "https://formbricks.com/gdpr",
            icon: LinkIcon,
            target: "_blank",
            hidden: !IS_FORMBRICKS_CLOUD,
          },
          {
            name: "Privacy",
            href: "https://formbricks.com/privacy",
            icon: LinkIcon,
            target: "_blank",
            hidden: !IS_FORMBRICKS_CLOUD,
          },
          {
            name: "Terms",
            href: "https://formbricks.com/terms",
            icon: LinkIcon,
            target: "_blank",
            hidden: !IS_FORMBRICKS_CLOUD,
          },
          {
            name: "License",
            href: "https://github.com/formbricks/formbricks/blob/main/LICENSE",
            icon: LinkIcon,
            target: "_blank",
            hidden: false,
          },
        ],
      },
    ],
    [environmentId, pathname]
  );

  if (!navigation) return null;

  return (
    <div className="fixed h-full bg-white py-2 pl-4 pr-10">
      <nav className="flex-1 space-y-1 bg-white px-2">
        {navigation.map((item) => (
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
            <div className="ml-2 mt-1 space-y-1">
              {item.links
                .filter((l) => !l.hidden)
                .map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    target={link.target}
                    className={clsx(
                      link.current ? "bg-slate-100 text-slate-900" : "text-slate-900 hover:bg-slate-50 ",
                      "group flex items-center whitespace-nowrap rounded-md px-1 py-1 pl-2 text-sm font-medium "
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
        ))}
      </nav>
    </div>
  );
}
