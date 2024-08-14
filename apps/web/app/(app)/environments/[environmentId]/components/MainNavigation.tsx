"use client";

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
import { ProfileAvatar } from "@formbricks/ui/Avatars";
import { Button } from "@formbricks/ui/Button";
import { CreateOrganizationModal } from "@formbricks/ui/CreateOrganizationModal";
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
} from "@formbricks/ui/DropdownMenu";

interface NavigationProps {
  environment: TEnvironment;
  organizations: TOrganization[];
  user: TUser;
  organization: TOrganization;
  products: TProduct[];
  isFormbricksCloud: boolean;
  membershipRole?: TMembershipRole;
  isMultiOrgEnabled: boolean;
}

export const MainNavigation = ({
  environment,
  organizations,
  organization,
  user,
  products,
  isFormbricksCloud,
  membershipRole,
  isMultiOrgEnabled,
}: NavigationProps) => {
  const router = useRouter();
  const pathname = usePathname();

  const [currentOrganizationName, setCurrentOrganizationName] = useState("");
  const [currentOrganizationId, setCurrentOrganizationId] = useState("");
  const [showCreateOrganizationModal, setShowCreateOrganizationModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isTextVisible, setIsTextVisible] = useState(true);

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
    router.push(`/organizations/${organizationId}/products/new/channel`);
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
      icon: ArrowUpRightIcon,
    },
  ];

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
