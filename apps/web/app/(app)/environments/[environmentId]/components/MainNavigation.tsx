"use client";

import { getLatestStableFbReleaseAction } from "@/app/(app)/environments/[environmentId]/actions/actions";
import { NavigationLink } from "@/app/(app)/environments/[environmentId]/components/NavigationLink";
import { formbricksLogout } from "@/app/lib/formbricks";
import FBLogo from "@/images/formbricks-wordmark.svg";
import { CreateOrganizationModal } from "@/modules/organization/components/CreateOrganizationModal";
import { ProfileAvatar } from "@/modules/ui/components/avatars";
import { Button } from "@/modules/ui/components/button";
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
} from "@/modules/ui/components/dropdown-menu";
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
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AiOutlineDiscord } from "react-icons/ai";
import { cn } from "@formbricks/lib/cn";
import { getAccessFlags } from "@formbricks/lib/membership/utils";
import { capitalizeFirstLetter } from "@formbricks/lib/utils/strings";
import { TEnvironment } from "@formbricks/types/environment";
import { TOrganizationRole } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProduct } from "@formbricks/types/product";
import { TUser } from "@formbricks/types/user";
import packageJson from "../../../../../package.json";

interface NavigationProps {
  environment: TEnvironment;
  organizations: TOrganization[];
  user: TUser;
  organization: TOrganization;
  products: TProduct[];
  isMultiOrgEnabled: boolean;
  isFormbricksCloud?: boolean;
  membershipRole?: TOrganizationRole;
}

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
  const t = useTranslations();
  const [currentOrganizationName, setCurrentOrganizationName] = useState("");
  const [currentOrganizationId, setCurrentOrganizationId] = useState("");
  const [showCreateOrganizationModal, setShowCreateOrganizationModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isTextVisible, setIsTextVisible] = useState(true);
  const [latestVersion, setLatestVersion] = useState("");

  const product = products.find((product) => product.id === environment.productId);
  const { isManager, isOwner, isMember, isBilling } = getAccessFlags(membershipRole);

  const isOwnerOrManager = isManager || isOwner;
  const isPricingDisabled = isMember;

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
        name: t("common.surveys"),
        href: `/environments/${environment.id}/surveys`,
        icon: MessageCircle,
        isActive: pathname?.includes("/surveys"),
        isHidden: false,
      },
      {
        name: t("common.people"),
        href: `/environments/${environment.id}/people`,
        icon: UserIcon,
        isActive:
          pathname?.includes("/people") ||
          pathname?.includes("/segments") ||
          pathname?.includes("/attributes"),
      },
      {
        name: t("common.actions"),
        href: `/environments/${environment.id}/actions`,
        icon: MousePointerClick,
        isActive: pathname?.includes("/actions") || pathname?.includes("/actions"),
      },
      {
        name: t("common.integrations"),
        href: `/environments/${environment.id}/integrations`,
        icon: BlocksIcon,
        isActive: pathname?.includes("/integrations"),
      },
      {
        name: t("common.configuration"),
        href: `/environments/${environment.id}/product/general`,
        icon: Cog,
        isActive: pathname?.includes("/product"),
      },
    ],
    [environment.id, pathname, isMember]
  );

  const dropdownNavigation = [
    {
      label: t("common.account"),
      href: `/environments/${environment.id}/settings/profile`,
      icon: UserCircleIcon,
    },
    {
      label: t("common.organization"),
      href: `/environments/${environment.id}/settings/general`,
      icon: UsersIcon,
    },
    {
      label: t("common.billing"),
      href: `/environments/${environment.id}/settings/billing`,
      hidden: !isFormbricksCloud,
      icon: CreditCardIcon,
    },
    {
      label: t("common.license"),
      href: `/environments/${environment.id}/settings/enterprise`,
      hidden: isFormbricksCloud || isPricingDisabled,
      icon: KeyIcon,
    },
    {
      label: t("common.documentation"),
      href: "https://formbricks.com/docs",
      target: "_blank",
      icon: ArrowUpRightIcon,
    },
    {
      label: t("common.join_discord"),
      href: "https://formbricks.com/discord",
      target: "_blank",
      icon: AiOutlineDiscord,
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
    if (isOwnerOrManager) loadReleases();
  }, [isOwnerOrManager]);

  const mainNavigationLink = `/environments/${environment.id}/${isBilling ? "settings/billing/" : "surveys/"}`;

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
                  href={mainNavigationLink}
                  className={cn(
                    "flex items-center justify-center transition-opacity duration-100",
                    isTextVisible ? "opacity-0" : "opacity-100"
                  )}>
                  <Image src={FBLogo} width={160} height={30} alt={t("environments.formbricks_logo")} />
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
            {!isBilling && (
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
            )}
          </div>

          <div>
            {/* New Version Available */}
            {!isCollapsed && isOwnerOrManager && latestVersion && !isFormbricksCloud && (
              <Link
                href="https://github.com/formbricks/formbricks/releases"
                target="_blank"
                className="m-2 flex items-center space-x-4 rounded-lg border border-slate-200 bg-slate-100 p-2 text-sm text-slate-800 hover:border-slate-300 hover:bg-slate-200">
                <p className="flex items-center justify-center gap-x-2 text-xs">
                  <RocketIcon strokeWidth={1.5} className="mx-1 h-6 w-6 text-slate-900" />
                  {t("common.new_version_available", { version: latestVersion })}
                </p>
              </Link>
            )}

            {/* Product Switch */}
            {!isBilling && (
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
                        className="cursor-pointer break-all"
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
                  {isOwnerOrManager && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleAddProduct(organization.id)}
                        icon={<PlusIcon className="mr-2 h-4 w-4" />}>
                        <span>{t("common.add_product")}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

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
                          className="flex w-full items-center"
                          key={link.label}>
                          <DropdownMenuItem>
                            <link.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                            {link.label}
                          </DropdownMenuItem>
                        </Link>
                      )
                  )}

                  {/* Logout */}

                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut({ callbackUrl: "/auth/login" });
                      await formbricksLogout();
                    }}
                    icon={<LogOutIcon className="h-4 w-4" strokeWidth={1.5} />}>
                    {t("common.logout")}
                  </DropdownMenuItem>

                  {/* Organization Switch */}

                  {(isMultiOrgEnabled || organizations.length > 1) && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="rounded-lg">
                        <div>
                          <p>{currentOrganizationName}</p>
                          <p className="block text-xs text-slate-500">{t("common.switch_organization")}</p>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent sideOffset={10} alignOffset={5}>
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
                              icon={<PlusIcon className="mr-2 h-4 w-4" />}>
                              <span>{t("common.create_new_organization")}</span>
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
