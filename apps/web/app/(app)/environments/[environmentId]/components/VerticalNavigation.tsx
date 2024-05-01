"use client";

/* import { formbricksLogout } from "@/app/lib/formbricks";
import clsx from "clsx"; */

/* import Link from "next/link"; */
import NavigationLink from "@/app/(app)/environments/[environmentId]/components/NavigationLink";
import {
  BlocksIcon,
  BrushIcon,
  CodeIcon,
  CreditCardIcon,
  FileCheckIcon,
  HeartIcon,
  LanguagesIcon,
  LinkIcon,
  MessageCircle,
  MousePointerClick,
  Settings,
  SlidersIcon,
  UserCircleIcon,
  UsersIcon,
} from "lucide-react";
import type { Session } from "next-auth";

/* import { signOut } from "next-auth/react"; */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

/* import formbricks from "@formbricks/js/app"; */

/* import { cn } from "@formbricks/lib/cn"; */
import { getAccessFlags } from "@formbricks/lib/membership/utils";

/* import { capitalizeFirstLetter, truncate } from "@formbricks/lib/strings"; */
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TProduct } from "@formbricks/types/product";
import { TTeam } from "@formbricks/types/teams";

/* import { ProfileAvatar } from "@formbricks/ui/Avatars";
import CreateTeamModal from "@formbricks/ui/CreateTeamModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@formbricks/ui/DropdownMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui/Popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";
import { CustomersIcon, DashboardIcon, FilterIcon, FormIcon, SettingsIcon } from "@formbricks/ui/icons";

import AddProductModal from "./AddProductModal";
import UrlShortenerModal from "./UrlShortenerModal"; */

interface NavigationProps {
  environment: TEnvironment;
  teams: TTeam[];
  session: Session;
  team: TTeam;
  products: TProduct[];
  environments: TEnvironment[];
  isFormbricksCloud: boolean;
  webAppUrl: string;
  membershipRole?: TMembershipRole;
  isMultiLanguageAllowed: boolean;
}

export default function Navigation({
  environment,
  teams,
  team,
  session,
  products,
  environments,
  isFormbricksCloud,
  webAppUrl,
  membershipRole,
  isMultiLanguageAllowed,
}: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentTeamName, setCurrentTeamName] = useState("");
  const [currentTeamId, setCurrentTeamId] = useState("");
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showLinkShortenerModal, setShowLinkShortenerModal] = useState(false);
  const product = products.find((product) => product.id === environment.productId);
  const [mobileNavMenuOpen, setMobileNavMenuOpen] = useState(false);
  const { isAdmin, isOwner, isViewer } = getAccessFlags(membershipRole);
  const isPricingDisabled = !isOwner && !isAdmin;

  useEffect(() => {
    if (environment && environment.widgetSetupCompleted) {
      setWidgetSetupCompleted(true);
    } else {
      setWidgetSetupCompleted(false);
    }
  }, [environment]);

  useEffect(() => {
    if (team && team.name !== "") {
      setCurrentTeamName(team.name);
      setCurrentTeamId(team.id);
    }
  }, [team]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => a.name.localeCompare(b.name));
  }, [teams]);

  const navigationItems = useMemo(
    () => [
      {
        name: "Surveys",
        href: `/environments/${environment.id}/surveys`,
        icon: MessageCircle,
        isActive: pathname?.includes("/surveys"),
        isHidden: false,
      },
      {
        name: "Respondents",
        href: `/environments/${environment.id}/people`,
        icon: UsersIcon,
        isActive: pathname?.includes("/people") || pathname?.includes("/segments"),
      },
      {
        name: "Actions",
        href: `/environments/${environment.id}/actions`,
        icon: MousePointerClick,
        isActive: pathname?.includes("/actions") || pathname?.includes("/attributes"),
        isHidden: false,
      },
      {
        name: "Integrations",
        href: `/environments/${environment.id}/integrations`,
        icon: BlocksIcon,
        isActive: pathname?.includes("/integrations"),
        isHidden: isViewer,
      },
      {
        name: "Settings",
        href: `/environments/${environment.id}/settings/product`,
        icon: Settings,
        isActive: pathname?.includes("/settings"),
        isHidden: false,
      },
    ],
    [environment.id, pathname, isViewer]
  );

  const dropdownNavigation = [
    {
      title: "Survey",
      links: [
        {
          icon: SlidersIcon,
          label: "Product Settings",
          href: `/environments/${environment.id}/settings/product`,
          hidden: false,
        },
        {
          icon: BrushIcon,
          label: "Look & Feel",
          href: `/environments/${environment.id}/settings/lookandfeel`,
          hidden: isViewer,
        },
        {
          icon: LanguagesIcon,
          label: "Survey Languages",
          href: `/environments/${environment.id}/settings/language`,
          hidden: !isMultiLanguageAllowed,
        },
      ],
    },
    {
      title: "Account",
      links: [
        {
          icon: UserCircleIcon,
          label: "Profile",
          href: `/environments/${environment.id}/settings/profile`,
        },
        { icon: UsersIcon, label: "Team", href: `/environments/${environment.id}/settings/members` },
        {
          icon: CreditCardIcon,
          label: "Billing & Plan",
          href: `/environments/${environment.id}/settings/billing`,
          hidden: !isFormbricksCloud || isPricingDisabled,
        },
      ],
    },
    {
      title: "Setup",
      links: [
        {
          icon: FileCheckIcon,
          label: "Setup checklist",
          href: `/environments/${environment.id}/settings/setup`,
          hidden: widgetSetupCompleted,
        },
        {
          icon: LinkIcon,
          label: "Link Shortener",
          href: pathname,
          onClick: () => {
            setShowLinkShortenerModal(true);
          },
        },
        {
          icon: CodeIcon,
          label: "Developer Docs",
          href: "https://formbricks.com/docs",
          target: "_blank",
        },
        {
          icon: HeartIcon,
          label: "Contribute to Formbricks",
          href: "https://github.com/formbricks/formbricks",
          target: "_blank",
        },
      ],
    },
  ];

  const handleEnvironmentChange = (environmentType: "production" | "development") => {
    const newEnvironmentId = environments.find((e) => e.type === environmentType)?.id;
    if (newEnvironmentId) {
      router.push(`/environments/${newEnvironmentId}/`);
    }
  };

  const handleEnvironmentChangeByProduct = (productId: string) => {
    router.push(`/products/${productId}/`);
  };

  const handleEnvironmentChangeByTeam = (teamId: string) => {
    router.push(`/teams/${teamId}/`);
  };

  if (pathname?.includes("/edit")) return null;

  return (
    <>
      {product && (
        <aside className="border-50 h-5/6 rounded-r-3xl border bg-white py-5">
          <ul>
            {navigationItems.map(
              (item) =>
                !item.isHidden && (
                  <NavigationLink key={item.name} href={item.href} isActive={item.isActive}>
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </NavigationLink>
                )
            )}
          </ul>
        </aside>
      )}
    </>
  );
}
