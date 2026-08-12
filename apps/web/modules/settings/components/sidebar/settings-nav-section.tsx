"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { SettingsNavLink } from "@/modules/settings/components/sidebar/settings-nav-link";
import type { NavItem } from "@/modules/settings/components/sidebar/types";

interface SettingsNavSectionProps {
  items: NavItem[];
  isCollapsed: boolean;
  isTextVisible: boolean;
}

// The list of links under a section header. It owns the active-state match and the shared
// "you can't do this" tooltip copy so every sidebar section highlights and explains itself the same way.
export const SettingsNavSection = ({
  items,
  isCollapsed,
  isTextVisible,
}: Readonly<SettingsNavSectionProps>) => {
  const pathname = usePathname();
  const { t } = useTranslation();

  const disabledMessage = t("common.you_are_not_authorized_to_perform_this_action");
  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <ul className="space-y-0.5">
      {visibleItems.map((item) => (
        <SettingsNavLink
          key={item.id}
          item={item}
          isActive={pathname.includes(item.href)}
          isCollapsed={isCollapsed}
          isTextVisible={isTextVisible}
          disabledMessage={item.disabled ? disabledMessage : undefined}
        />
      ))}
    </ul>
  );
};
