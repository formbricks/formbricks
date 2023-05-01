"use client";

import FaveIcon from "@/app/favicon.ico";
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
} from "@/components/shared/DropdownMenu";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useEnvironment } from "@/lib/environments/environments";
import { useMemberships } from "@/lib/memberships";
import { useTeam } from "@/lib/teams/teams";
import { capitalizeFirstLetter } from "@/lib/utils";
import {
  CustomersIcon,
  ErrorComponent,
  FilterIcon,
  FormIcon,
  ProfileAvatar,
  SettingsIcon,
} from "@formbricks/ui";
import {
  AdjustmentsVerticalIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
  CodeBracketIcon,
  CreditCardIcon,
  DocumentCheckIcon,
  HeartIcon,
  PaintBrushIcon,
  PlusIcon,
  UserCircleIcon,
  UsersIcon,
} from "@heroicons/react/24/solid";
import clsx from "clsx";
import type { Session } from "next-auth";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AddProductModal from "./AddProductModal";

interface EnvironmentsNavbarProps {
  environmentId: string;
  session: Session;
}

export default function EnvironmentsNavbar({ environmentId, session }: EnvironmentsNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const { environment, isErrorEnvironment, isLoadingEnvironment } = useEnvironment(environmentId);
  const { memberships, isErrorMemberships, isLoadingMemberships } = useMemberships();
  const { team } = useTeam(environmentId);

  const [currentTeamName, setCurrentTeamName] = useState("");
  const [currentTeamId, setCurrentTeamId] = useState("");
  const [loading, setLoading] = useState(false);
  const [widgetSetupCompleted, setWidgetSetupCompleted] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);

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

  const navigation = useMemo(
    () => [
      {
        name: "Surveys",
        href: `/environments/${environmentId}/surveys`,
        icon: FormIcon,
        current: pathname?.includes("/surveys"),
      },
      {
        name: "People",
        href: `/environments/${environmentId}/people`,
        icon: CustomersIcon,
        current: pathname?.includes("/people"),
      },
      {
        name: "Actions & Attributes",
        href: `/environments/${environmentId}/events`,
        icon: FilterIcon,
        current: pathname?.includes("/events") || pathname?.includes("/attributes"),
      },
      /*       {
        name: "Integrations",
        href: `/environments/${environmentId}/integrations/installation`,
        icon: DashboardIcon,
        current: pathname?.includes("/integrations"),
      }, */
      {
        name: "Settings",
        href: `/environments/${environmentId}/settings/profile`,
        icon: SettingsIcon,
        current: pathname?.includes("/settings"),
      },
    ],
    [environmentId, pathname]
  );

  const dropdownnavigation = [
    {
      title: "Survey",
      links: [
        {
          icon: AdjustmentsVerticalIcon,
          label: "Product Settings",
          href: `/environments/${environmentId}/settings/product`,
        },
        {
          icon: PaintBrushIcon,
          label: "Look & Feel",
          href: `/environments/${environmentId}/settings/lookandfeel`,
        },
      ],
    },
    {
      title: "Account",
      links: [
        {
          icon: UserCircleIcon,
          label: "Profile",
          href: `/environments/${environmentId}/settings/profile`,
        },
        { icon: UsersIcon, label: "Team", href: `/environments/${environmentId}/settings/members` },
        {
          icon: CreditCardIcon,
          label: "Billing & Plan",
          href: `/environments/${environmentId}/settings/billing`,
          hidden: process.env.NEXT_PUBLIC_IS_FORMBRICKS_CLOUD !== "1",
        },
      ],
    },
    {
      title: "Setup",
      links: [
        {
          icon: DocumentCheckIcon,
          label: "Setup checklist",
          href: `/environments/${environmentId}/settings/setup`,
          hidden: widgetSetupCompleted,
        },
        {
          icon: CodeBracketIcon,
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

  const changeEnvironment = (environmentType: string) => {
    const newEnvironmentId = environment.product.environments.find((e) => e.type === environmentType)?.id;
    router.push(`/environments/${newEnvironmentId}/`);
  };

  const changeEnvironmentByProduct = (productId: string) => {
    const product = environment.availableProducts.find((p) => p.id === productId);
    const newEnvironmentId = product?.environments[0]?.id;
    router.push(`/environments/${newEnvironmentId}/`);
  };

  const changeEnvironmentByTeam = (teamId: string) => {
    const newTeamMembership = memberships.find((m) => m.teamId === teamId);
    const newTeamProduct = newTeamMembership?.team?.products?.[0];

    if (newTeamProduct) {
      const newEnvironmentId = newTeamProduct.environments.find((e) => e.type === "production")?.id;

      if (newEnvironmentId) {
        router.push(`/environments/${newEnvironmentId}/`);
      }
    }
  };

  if (isLoadingEnvironment || loading || isLoadingMemberships) {
    return <LoadingSpinner />;
  }

  if (isErrorEnvironment || isErrorMemberships) {
    return <ErrorComponent />;
  }

  return (
    <nav className="top-0 z-10 w-full border-b border-slate-200 bg-white">
      {environment?.type === "development" && (
        <div className="h-6 w-full bg-[#A33700] p-0.5 text-center text-sm text-white">
          You&apos;re in development mode. Use it to test surveys, events and attributes.
        </div>
      )}

      <div className="w-full px-4 sm:px-6">
        <div className="flex h-14 justify-between">
          <div className="flex  space-x-4 py-2">
            <Link
              href={`/environments/${environmentId}/surveys/`}
              className=" flex items-center justify-center rounded-md bg-gradient-to-b text-white transition-all ease-in-out hover:scale-105">
              {/* <PlusIcon className="h-6 w-6" /> */}
              <Image src={FaveIcon} width={30} height={30} alt="faveicon" />
            </Link>
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={clsx(
                  item.current
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-900 hover:bg-slate-50 hover:text-slate-900",
                  "inline-flex items-center rounded-md px-2 py-1 text-sm font-medium"
                )}
                aria-current={item.current ? "page" : undefined}>
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            ))}
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex cursor-pointer flex-row items-center space-x-5">
                  {session.user.image ? (
                    <Image
                      src={session.user.image}
                      width="100"
                      height="100"
                      className="ph-no-capture h-9 w-9 rounded-full"
                      alt="Profile picture"
                    />
                  ) : (
                    <ProfileAvatar userId={session.user.id} />
                  )}

                  <div>
                    <p className="ph-no-capture ph-no-capture -mb-0.5 text-sm font-bold text-slate-700">
                      {environment?.product?.name}
                    </p>
                    <p className="text-sm text-slate-500">{capitalizeFirstLetter(environment?.type)}</p>
                  </div>
                  <ChevronDownIcon className="h-5 w-5 text-slate-700 hover:text-slate-500" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>
                  <span className="ph-no-capture font-normal">Signed in as</span> {session.user.name}
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                {/* Product Switch */}

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <div>
                      <p className="ph-no-capture">{environment?.product?.name}</p>
                      <p className=" block text-xs text-slate-500">Product</p>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={environment?.product.id}
                        onValueChange={changeEnvironmentByProduct}>
                        {environment?.availableProducts?.map((product) => (
                          <DropdownMenuRadioItem
                            value={product.id}
                            className="cursor-pointer"
                            key={product.id}>
                            {product.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowAddProductModal(true)}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        <span>Add product</span>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                {/* Environment Switch */}

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <div>
                      <p>{capitalizeFirstLetter(environment?.type)}</p>
                      <p className=" block text-xs text-slate-500">Environment</p>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={environment?.type}
                        onValueChange={(v) => changeEnvironment(v)}>
                        <DropdownMenuRadioItem value="production" className="cursor-pointer">
                          Production
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="development" className="cursor-pointer">
                          Development
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                {/* Team Switch */}
                {memberships.length > 1 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <div>
                        <p>{currentTeamName}</p>
                        <p className="block text-xs text-slate-500">Team</p>
                      </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={currentTeamId}
                          onValueChange={(teamId) => changeEnvironmentByTeam(teamId)}>
                          {memberships?.map((membership) => (
                            <DropdownMenuRadioItem
                              value={membership.teamId}
                              className="cursor-pointer"
                              key={membership.teamId}>
                              {membership.team.name}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                )}

                {dropdownnavigation.map((item) => (
                  <DropdownMenuGroup key={item.title}>
                    <DropdownMenuSeparator />
                    {item.links.map(
                      (link) =>
                        !link.hidden && (
                          <Link href={link.href} target={link.target} key={link.label}>
                            <DropdownMenuItem key={link.label}>
                              <div className="flex items-center">
                                <link.icon className="mr-2 h-4 w-4" />
                                <span>{link.label}</span>
                              </div>
                            </DropdownMenuItem>
                          </Link>
                        )
                    )}
                  </DropdownMenuGroup>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => {
                      signOut();
                      setLoading(true);
                    }}>
                    <div className="flex h-full w-full items-center">
                      <ArrowRightOnRectangleIcon className="mr-2 h-4 w-4" />
                      Logout
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <AddProductModal
        open={showAddProductModal}
        setOpen={(val) => setShowAddProductModal(val)}
        environmentId={environmentId}
      />
    </nav>
  );
}
