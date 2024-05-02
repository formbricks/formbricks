import SecondNavbar from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/attributes/components/SecondNavbar";
import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";

interface ProductConfigTabsProps {
  activeId: string;
  environmentId: string;
  isUserTargetingAllowed?: boolean;
}

export default function ProductConfigTabs({ activeId, environmentId }: ProductConfigTabsProps) {
  let tabs = [
    {
      id: "general",
      label: "General",
      icon: <UsersIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/general`,
    },
    {
      id: "look",
      label: "Look & Feel",
      icon: <BrushIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/look`,
    },
    {
      id: "languages",
      label: "Survey Languages",
      icon: <LanguagesIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/languages`,
    },
    {
      id: "tags",
      label: "Tags",
      icon: <TagIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/tags`,
    },
    {
      id: "api-keys",
      label: "API Keys",
      icon: <KeyIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/api-keys`,
    },
    {
      id: "setup",
      label: "Setup Guide",
      icon: <ListChecksIcon className="h-5 w-5" />,
      href: `/environments/${environmentId}/product/setup`,
    },
  ];

  return <SecondNavbar tabs={tabs} activeId={activeId} environmentId={environmentId} />;
}
