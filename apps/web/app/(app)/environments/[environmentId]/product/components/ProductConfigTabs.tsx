import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";

import SecondNavigation from "@formbricks/ui/SecondNavigation";

interface ProductConfigTabsProps {
  activeId: string;
  environmentId: string;
  isUserTargetingAllowed?: boolean;
}

export default function ProductConfigTabs({ activeId, environmentId }: ProductConfigTabsProps) {
  let navigation = [
    {
      id: "general",
      label: "General",
      icon: <UsersIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/general`,
      current: activeId === "general",
    },
    {
      id: "look",
      label: "Look & Feel",
      icon: <BrushIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/look`,
      current: activeId === "look",
    },
    {
      id: "languages",
      label: "Survey Languages",
      icon: <LanguagesIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/languages`,
      current: activeId === "languages",
    },
    {
      id: "tags",
      label: "Tags",
      icon: <TagIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/tags`,
      current: activeId === "tags",
    },
    {
      id: "api-keys",
      label: "API Keys",
      icon: <KeyIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/api-keys`,
      current: activeId === "api-keys",
    },
    {
      id: "setup",
      label: "Setup Guide",
      icon: <ListChecksIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/setup`,
      current: activeId === "setup",
    },
  ];

  return <SecondNavigation navigation={navigation} />;
}
