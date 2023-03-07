import {
  AdjustmentsVerticalIcon,
  ChatBubbleLeftEllipsisIcon,
  CodeBracketIcon,
  CreditCardIcon,
  DocumentCheckIcon,
  DocumentMagnifyingGlassIcon,
  MegaphoneIcon,
  PaintBrushIcon,
  PlusCircleIcon,
  ScaleIcon,
  StarIcon,
  UserCircleIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";

export default function SettingsNavbar({ environmentId }: { environmentId: string }) {
  const navigation = [
    {
      title: "Account",
      links: [
        {
          name: "Profile",
          href: `/environments/${environmentId}/settings/profile`,
          icon: UserCircleIcon,
        },
        /*         {
          name: "Notifications",
          href: `/environments/${environmentId}/settings/notifications`,
          icon: MegaphoneIcon,
           
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
        },
        {
          name: "Look & Feel",
          href: `/environments/${environmentId}/settings/lookandfeel`,
          icon: PaintBrushIcon,
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
        },
        {
          name: "Tags",
          href: `/environments/${environmentId}/settings/tags`,
          icon: PlusCircleIcon,
        },
        {
          name: "Billing & Plan",
          href: `/environments/${environmentId}/settings/billing`,
          icon: CreditCardIcon,
        },
        {
          name: "Legal",
          href: "/settings/legal",
          icon: ScaleIcon,
        },
      ],
    },
    {
      title: "Setup",
      links: [
        { name: "Setup Checklist", href: "/settings/setup", icon: DocumentCheckIcon, current: false },
        { name: "Web Client", href: "/settings/webclient", icon: CodeBracketIcon, current: false },
        {
          name: "Documentation",
          href: "https://formbricks.com/docs",
          icon: DocumentMagnifyingGlassIcon,

          target: "_blank",
        },
        {
          name: "Join Discord",
          href: "https://formbricks.com/discord",
          icon: ChatBubbleLeftEllipsisIcon,

          target: "_blank",
        },
        {
          name: "Star us on GitHub",
          href: "https://formbricks.com/github",
          icon: StarIcon,

          target: "_blank",
        },
      ],
    },
  ];

  return (
    <div className="flex h-screen flex-col bg-white pl-4 pr-10 pt-4">
      <nav className="flex-1  space-y-1 bg-white px-2">
        {navigation.map((item) => (
          <div key={item.title}>
            <p className="mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {item.title}
            </p>
            <div className="mt-1 ml-4 space-y-1">
              {item.links.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  target={link.target}
                  className={clsx(
                    link.current ? " bg-slate-200 text-slate-700" : "text-slate-600 hover:text-slate-900",
                    "group flex items-center whitespace-nowrap rounded-md px-1 py-1 text-sm font-medium"
                  )}>
                  <link.icon
                    className={clsx(
                      link.current ? "text-slate-500" : "text-slate-400 group-hover:text-slate-500",
                      "mr-3 h-4 w-4 flex-shrink-0"
                    )}
                    aria-hidden="true"
                  />
                  {link.name}
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
