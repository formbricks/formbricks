import {
  AdjustmentsVerticalIcon,
  ChatBubbleLeftEllipsisIcon,
  CodeBracketIcon,
  CreditCardIcon,
  DocumentCheckIcon,
  DocumentMagnifyingGlassIcon,
  LinkIcon,
  PaintBrushIcon,
  StarIcon,
  UserCircleIcon,
  UsersIcon,
  MegaphoneIcon,
} from "@heroicons/react/24/solid";

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
        {
          name: "Notifications",
          href: `/environments/${environmentId}/settings/notifications`,
          icon: MegaphoneIcon,
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
        } /* 
        {
          name: "Tags",
          href: `/environments/${environmentId}/settings/tags`,
          icon: PlusCircleIcon,
        }, */,
        {
          name: "Billing & Plan",
          href: `/environments/${environmentId}/settings/billing`,
          icon: CreditCardIcon,
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
        },
        {
          name: "Web Client",
          href: `/environments/${environmentId}/settings/webclient`,
          icon: CodeBracketIcon,
        },
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
    {
      title: "Compliance",
      links: [
        {
          name: "GDPR & CCPA",
          href: "https://formbricks.com/gdpr",
          icon: LinkIcon,
          target: "_blank",
        },
        {
          name: "Privacy Policy",
          href: "https://formbricks.com/privacy",
          icon: LinkIcon,
          target: "_blank",
        },
        {
          name: "Terms of Service",
          href: "https://formbricks.com/terms",
          icon: LinkIcon,
          target: "_blank",
        },
      ],
    },
  ];

  return (
    <div className=" flex h-screen flex-col bg-white pl-4 pr-10 pt-4">
      <nav className="flex-1 space-y-1 bg-white px-2">
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
                  className="group flex items-center whitespace-nowrap rounded-md px-1 py-1 text-sm font-medium text-slate-900 hover:text-slate-700">
                  <link.icon
                    className="mr-3 h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-slate-500"
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
