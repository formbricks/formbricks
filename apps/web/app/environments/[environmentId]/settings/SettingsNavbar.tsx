"use client";

import {
  AdjustmentsVerticalIcon,
  ChatBubbleLeftEllipsisIcon,
  CreditCardIcon,
  DocumentCheckIcon,
  DocumentMagnifyingGlassIcon,
  LinkIcon,
  PaintBrushIcon,
  UserCircleIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import Link from "next/link";

import { usePathname } from "next/navigation";

export default function SettingsNavbar({ environmentId }: { environmentId: string }) {
  const pathname = usePathname();
  const navigation = [
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
        /*         {
          name: "Notifications",
          href: `/environments/${environmentId}/settings/notifications`,
          icon: MegaphoneIcon,
          current: pathname?.includes("/notifications"),
        }, */
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
        /* 
        {
          name: "Tags",
          href: `/environments/${environmentId}/settings/tags`,
          icon: PlusCircleIcon,
           current: pathname?.includes("/tags"),
        }, */
        {
          name: "Billing & Plan",
          href: `/environments/${environmentId}/settings/billing`,
          icon: CreditCardIcon,
          hidden: process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD !== "1",
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
          hidden: process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD !== "1",
        },
        {
          name: "Privacy",
          href: "https://formbricks.com/privacy",
          icon: LinkIcon,
          target: "_blank",
          hidden: process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD !== "1",
        },
        {
          name: "Terms",
          href: "https://formbricks.com/terms",
          icon: LinkIcon,
          target: "_blank",
          hidden: process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD !== "1",
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
  ];

  return (
    <div className="fixed h-full bg-white py-2 pl-4 pr-10">
      <nav className="flex-1 space-y-1 bg-white px-2">
        {navigation.map((item) => (
          <div key={item.title}>
            <p className="mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {item.title}
            </p>
            <div className="mt-1 ml-2 space-y-1">
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
