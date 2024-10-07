"use client";

import { getLatestStableFbReleaseAction } from "@/app/(app)/environments/[environmentId]/actions/actions";
import { NavigationLink } from "@/app/(app)/environments/[environmentId]/components/NavigationLink";
import { formbricksLogout } from "@/app/lib/formbricks";
import FBLogo from "@/images/formbricks-wordmark.svg";
import {
  ArrowUpRightIcon,
  BlendIcon,
  BlocksIcon,
  ChevronRightIcon,
  Cog,
  CreditCardIcon,
  GlobeIcon,
  GlobeLockIcon,
  KeyIcon,
  LinkIcon,
  LogOutIcon,
  MessageCircle,
  MousePointerClick,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  RocketIcon,
  UserCircleIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { TEnvironment } from "@formbricks/types/environment";
import { TMembershipRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProduct } from "@formbricks/types/product";
import { TUser } from "@formbricks/types/user";
import { ProfileAvatar } from "@formbricks/ui/components/Avatars";
import { Button } from "@formbricks/ui/components/Button";
import { CreateOrganizationModal } from "@formbricks/ui/components/CreateOrganizationModal";
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
} from "@formbricks/ui/components/DropdownMenu";
import packageJson from "../../../../../package.json";

interface NavigationProps {
  environment: TEnvironment;
  organizations: TOrganization[];
  user: TUser;
  organization: TOrganization;
  products: TProduct[];
  isMultiOrgEnabled: boolean;
  isFormbricksCloud?: boolean;
  membershipRole?: TMembershipRole;
}

const discordIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 32 32"
      fill="#57534e"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <g>
        <path d="M9.82 17.41a3.1 3.1 0 0 0 2.9 3.26 3.1 3.1 0 0 0 2.89-3.26 3.11 3.11 0 0 0-2.89-3.27 3.11 3.11 0 0 0-2.9 3.27zm3.79 0c0 .68-.41 1.26-.89 1.26s-.9-.58-.9-1.26.41-1.27.9-1.27.89.58.89 1.27zm5.67-3.27a3.11 3.11 0 0 0-2.89 3.27 3.1 3.1 0 0 0 2.89 3.26 3.1 3.1 0 0 0 2.9-3.26 3.11 3.11 0 0 0-2.9-3.27zm0 4.53c-.48 0-.89-.58-.89-1.26s.41-1.27.89-1.27.9.58.9 1.27-.41 1.26-.9 1.26z"></path>
        <path d="m26.63 10.53-.07-.09v-.1a12.15 12.15 0 0 0-6.8-4.15 1 1 0 1 0-.48 1.94 10.19 10.19 0 0 1 5.65 3.39A24.87 24.87 0 0 1 27 21.33a10 10 0 0 1-5 2.52v-.51a13.48 13.48 0 0 0 3.43-1.95 1 1 0 0 0-1.25-1.57 12.83 12.83 0 0 1-8.18 2.6 12.83 12.83 0 0 1-8.11-2.6 1 1 0 0 0-1.25 1.57 13.36 13.36 0 0 0 3.41 1.95v.51a10 10 0 0 1-5-2.52 24.87 24.87 0 0 1 2.09-9.81 10.19 10.19 0 0 1 5.65-3.39 1 1 0 0 0-.48-1.94 12.15 12.15 0 0 0-6.8 4.15s0 .07 0 .1l-.07.09c-1.94 4-2.16 7.65-2.37 11.14a1 1 0 0 0 .29.77A12 12 0 0 0 11 26a1 1 0 0 0 .7-.29A1 1 0 0 0 12 25v-1a17.56 17.56 0 0 0 8 0v1a1 1 0 0 0 .3.71 1 1 0 0 0 .7.29 12 12 0 0 0 7.74-3.51 1 1 0 0 0 .29-.77c-.24-3.54-.46-7.15-2.4-11.19Z"></path>
        <path d="M23.49 11.72a1 1 0 0 0-.43-1.35A15.47 15.47 0 0 0 16 8.87a15.47 15.47 0 0 0-7.06 1.5 1 1 0 0 0-.43 1.35 1 1 0 0 0 1.35.42A13.55 13.55 0 0 1 16 10.87a13.55 13.55 0 0 1 6.14 1.27 1 1 0 0 0 .46.12 1 1 0 0 0 .89-.54Z"></path>
      </g>
    </svg>
  );
};

export const MainNavigation = ({
  environment,
  organizations,
  organization,
  user,
  products,
  isMultiOrgEnabled,
  isFormbricksCloud = true,
  membershipRole,
}: NavigationProps) => {
  const router = useRouter();
  const pathname = usePathname();

  const [currentOrganizationName, setCurrentOrganizationName] = useState("");
  const [currentOrganizationId, setCurrentOrganizationId] = useState("");
  const [showCreateOrganizationModal, setShowCreateOrganizationModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [latestVersion, setLatestVersion] = useState("");

  const product = products.find((product) => product.id === environment.productId);
  const { isAdmin, isOwner, isViewer } = getAccessFlags(membershipRole);
  const isOwnerOrAdmin = isAdmin || isOwner;
  const isPricingDisabled = !isOwner && !isAdmin;

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    localStorage.setItem("isMainNavCollapsed", isCollapsed ? "false" : "true");
  };

  useEffect(() => {
    const isCollapsedValueFromLocalStorage = localStorage.getItem("isMainNavCollapsed") === "true";
    setIsCollapsed(isCollapsedValueFromLocalStorage);
  }, []);

  useEffect(() => {
    const toggleTextOpacity = () => {
      setIsTextVisible(isCollapsed ? true : false);
    };
    const timeoutId = setTimeout(toggleTextOpacity, 150);
    return () => clearTimeout(timeoutId);
  }, [isCollapsed]);

  useEffect(() => {
    if (organization && organization.name !== "") {
      setCurrentOrganizationName(organization.name);
      setCurrentOrganizationId(organization.id);
    }
  }, [organization]);

  const sortedOrganizations = useMemo(() => {
    return [...organizations].sort((a, b) => a.name.localeCompare(b.name));
  }, [organizations]);

  const sortedProducts = useMemo(() => {
    const channelOrder: (string | null)[] = ["website", "app", "link", null];

    const groupedProducts = products.reduce(
      (acc, product) => {
        const channel = product.config.channel;
        const key = channel !== null ? channel : "null";
        acc[key] = acc[key] || [];
        acc[key].push(product);
        return acc;
      },
      {} as Record<string, typeof products>
    );

    Object.keys(groupedProducts).forEach((channel) => {
      groupedProducts[channel].sort((a, b) => a.name.localeCompare(b.name));
    });

    return channelOrder.flatMap((channel) => groupedProducts[channel !== null ? channel : "null"] || []);
  }, [products]);

  const handleEnvironmentChangeByProduct = (productId: string) => {
    router.push(`/products/${productId}/`);
  };

  const handleEnvironmentChangeByOrganization = (organizationId: string) => {
    router.push(`/organizations/${organizationId}/`);
  };

  const handleAddProduct = (organizationId: string) => {
    router.push(`/organizations/${organizationId}/products/new/mode`);
  };

  const mainNavigation = useMemo(
    () => [
      {
        name: "Surveys",
        href: `/environments/${environment.id}/surveys`,
        icon: MessageCircle,
        isActive: pathname?.includes("/surveys"),
        isHidden: false,
      },
      {
        name: "People",
        href: `/environments/${environment.id}/people`,
        icon: UserIcon,
        isActive:
          pathname?.includes("/people") ||
          pathname?.includes("/segments") ||
          pathname?.includes("/attributes"),
      },
      {
        name: "Actions",
        href: `/environments/${environment.id}/actions`,
        icon: MousePointerClick,
        isActive: pathname?.includes("/actions") || pathname?.includes("/actions"),
        isHidden: product?.config.channel === "link",
      },
      {
        name: "Integrations",
        href: `/environments/${environment.id}/integrations`,
        icon: BlocksIcon,
        isActive: pathname?.includes("/integrations"),
        isHidden: isViewer,
      },
      {
        name: "Configuration",
        href: `/environments/${environment.id}/product/general`,
        icon: Cog,
        isActive: pathname?.includes("/product"),
        isHidden: isViewer,
      },
    ],
    [environment.id, pathname, product?.config.channel, isViewer]
  );

  const dropdownNavigation = [
    {
      label: "Account",
      href: `/environments/${environment.id}/settings/profile`,
      icon: UserCircleIcon,
    },
    {
      label: "Organization",
      href: `/environments/${environment.id}/settings/members`,
      icon: UsersIcon,
    },
    {
      label: "Billing",
      href: `/environments/${environment.id}/settings/billing`,
      hidden: !isFormbricksCloud || isPricingDisabled,
      icon: CreditCardIcon,
    },
    {
      label: "License",
      href: `/environments/${environment.id}/settings/enterprise`,
      hidden: isFormbricksCloud || isPricingDisabled,
      icon: KeyIcon,
    },
    {
      label: "Documentation",
      href: "https://formbricks.com/docs",
      target: "_blank",
      icon: ArrowUpRightIcon,
    },
    {
      label: "Join Discord",
      href: "https://formbricks.com/discord",
      target: "_blank",
      icon: discordIcon,
    },
  ];

  useEffect(() => {
    async function loadReleases() {
      const res = await getLatestStableFbReleaseAction();
      if (res?.data) {
        const latestVersionTag = res.data;
        const currentVersionTag = `v${packageJson.version}`;

        if (currentVersionTag !== latestVersionTag) {
          setLatestVersion(latestVersionTag);
        }
      }
    }
    if (isOwnerOrAdmin) loadReleases();
  }, [isOwnerOrAdmin]);

  return (
    <>
      {product && (
        <aside
          className={cn(
            "z-40 flex flex-col justify-between rounded-r-xl border-r border-slate-200 bg-white pt-3 shadow-md transition-all duration-100",
            !isCollapsed ? "w-sidebar-collapsed" : "w-sidebar-expanded",
            environment.type === "development" ? `h-[calc(100vh-1.25rem)]` : "h-screen"
          )}>
          <div>
            {/* Logo and Toggle */}

            <div className="flex items-center justify-between px-3 pb-4">
              {!isCollapsed && (
                <Link
                  href={`/environments/${environment.id}/surveys/`}
                  className={cn(
                    "flex items-center justify-center transition-opacity duration-100",
                    isTextVisible ? "opacity-0" : "opacity-100"
                  )}>
                  <Image src={FBLogo} width={160} height={30} alt="Formbricks Logo" />
                </Link>
              )}
              <Button
                variant="minimal"
                size="icon"
                tooltipSide="right"
                onClick={toggleSidebar}
                className={cn(
                  "rounded-xl bg-slate-50 p-1 text-slate-600 transition-all hover:bg-slate-100 focus:outline-none focus:ring-0 focus:ring-transparent"
                )}>
                {isCollapsed ? (
                  <PanelLeftOpenIcon strokeWidth={1.5} />
                ) : (
                  <PanelLeftCloseIcon strokeWidth={1.5} />
                )}
              </Button>
            </div>

            {/* Main Nav Switch */}
            <ul>
              {mainNavigation.map(
                (item) =>
                  !item.isHidden && (
                    <NavigationLink
                      key={item.name}
                      href={item.href}
                      isActive={item.isActive}
                      isCollapsed={isCollapsed}
                      isTextVisible={isTextVisible}
                      linkText={item.name}>
                      <item.icon strokeWidth={1.5} />
                    </NavigationLink>
                  )
              )}
            </ul>
          </div>

          {/* Product Switch */}
          <div>
            {/* New Version Available */}
            {!isCollapsed && isOwnerOrAdmin && latestVersion && !isFormbricksCloud && (
              <Link
                href="https://github.com/formbricks/formbricks/releases"
                target="_blank"
                className="m-2 flex items-center space-x-4 rounded-lg border border-slate-200 bg-slate-100 p-2 text-sm text-slate-800 hover:border-slate-300 hover:bg-slate-200">
                <p className="flex items-center justify-center gap-x-2 text-xs">
                  <RocketIcon strokeWidth={1.5} className="mx-1 h-6 w-6 text-slate-900" />
                  Formbricks {latestVersion} is here. Upgrade now!
                </p>
              </Link>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                id="productDropdownTrigger"
                className="w-full rounded-br-xl border-t py-4 transition-colors duration-200 hover:bg-slate-50 focus:outline-none">
                <div
                  tabIndex={0}
                  className={cn(
                    "flex cursor-pointer flex-row items-center space-x-3",
                    isCollapsed ? "pl-2" : "pl-4"
                  )}>
                  <div className="rounded-lg bg-slate-900 p-1.5 text-slate-50">
                    {product.config.channel === "website" ? (
                      <GlobeIcon strokeWidth={1.5} />
                    ) : product.config.channel === "app" ? (
                      <GlobeLockIcon strokeWidth={1.5} />
                    ) : product.config.channel === "link" ? (
                      <LinkIcon strokeWidth={1.5} />
                    ) : (
                      <BlendIcon strokeWidth={1.5} />
                    )}
                  </div>
                  {!isCollapsed && !isTextVisible && (
                    <>
                      <div>
                        <p
                          title={product.name}
                          className={cn(
                            "ph-no-capture ph-no-capture -mb-0.5 max-w-28 truncate text-sm font-bold text-slate-700 transition-opacity duration-200",
                            isTextVisible ? "opacity-0" : "opacity-100"
                          )}>
                          {product.name}
                        </p>
                        <p
                          className={cn(
                            "text-sm text-slate-500 transition-opacity duration-200",
                            isTextVisible ? "opacity-0" : "opacity-100"
                          )}>
                          {product.config.channel === "link"
                            ? "Link & Email"
                            : capitalizeFirstLetter(product.config.channel)}
                        </p>
                      </div>
                      <ChevronRightIcon
                        className={cn(
                          "h-5 w-5 text-slate-700 transition-opacity duration-200 hover:text-slate-500",
                          isTextVisible ? "opacity-0" : "opacity-100"
                        )}
                      />
                    </>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-fit space-y-1 rounded-xl border border-slate-200 shadow-sm"
                id="userDropdownInnerContentWrapper"
                side="right"
                sideOffset={10}
                alignOffset={-1}
                align="end">
                <DropdownMenuRadioGroup
                  value={product!.id}
                  onValueChange={(v) => handleEnvironmentChangeByProduct(v)}>
                  {sortedProducts.map((product) => (
                    <DropdownMenuRadioItem
                      value={product.id}
                      className="cursor-pointer break-all rounded-lg font-normal"
                      key={product.id}>
                      <div>
                        {product.config.channel === "website" ? (
                          <GlobeIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        ) : product.config.channel === "app" ? (
                          <GlobeLockIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        ) : product.config.channel === "link" ? (
                          <LinkIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        ) : (
                          <BlendIcon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="">{product?.name}</div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                {isOwnerOrAdmin && (
                  <DropdownMenuItem
                    onClick={() => handleAddProduct(organization.id)}
                    className="rounded-lg font-normal">
                    <PlusIcon className="mr-2 h-4 w-4" />
                    <span>Add product</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Switch */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  id="userDropdownTrigger"
                  className="w-full rounded-br-xl border-t py-4 transition-colors duration-200 hover:bg-slate-50 focus:outline-none">
                  <div
                    tabIndex={0}
                    className={cn(
                      "flex cursor-pointer flex-row items-center space-x-3",
                      isCollapsed ? "pl-2" : "pl-4"
                    )}>
                    <ProfileAvatar userId={user.id} imageUrl={user.imageUrl} />
                    {!isCollapsed && !isTextVisible && (
                      <>
                        <div className={cn(isTextVisible ? "opacity-0" : "opacity-100")}>
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
                    )}
                  </div>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-56 rounded-xl border border-slate-200 shadow-sm"
                  id="userDropdownInnerContentWrapper"
                  side="right"
                  sideOffset={10}
                  alignOffset={5}
                  align="end">
                  {/* Dropdown Items */}

                  {dropdownNavigation.map(
                    (link) =>
                      !link.hidden && (
                        <Link
                          href={link.href}
                          target={link.target}
                          key={link.label}
                          className="flex items-center">
                          <DropdownMenuItem
                            className="w-full gap-x-2 rounded-lg font-normal"
                            key={link.label}>
                            <link.icon className="h-4 w-4" strokeWidth={1.5} />
                            {link.label}
                          </DropdownMenuItem>
                        </Link>
                      )
                  )}

                  {/* Logout */}

                  <DropdownMenuItem
                    className="w-full gap-x-2 rounded-lg font-normal"
                    onClick={async () => {
                      await signOut({ callbackUrl: "/auth/login" });
                      await formbricksLogout();
                    }}>
                    <LogOutIcon className="h-4 w-4" strokeWidth={1.5} />
                    Logout
                  </DropdownMenuItem>

                  {/* Organization Switch */}

                  {(isMultiOrgEnabled || organizations.length > 1) && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="rounded-lg">
                        <div>
                          <p>{currentOrganizationName}</p>
                          <p className="block text-xs text-slate-500">Switch organization</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent
                          className="rounded-xl border border-slate-200 shadow-sm"
                          sideOffset={10}
                          alignOffset={5}>
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
                              onClick={() => setShowCreateOrganizationModal(true)}
                              className="rounded-lg">
                              <PlusIcon className="mr-2 h-4 w-4" />
                              <span>Create new organization</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </aside>
      )}
      <CreateOrganizationModal
        open={showCreateOrganizationModal}
        setOpen={(val) => setShowCreateOrganizationModal(val)}
      />
    </>
  );
};
