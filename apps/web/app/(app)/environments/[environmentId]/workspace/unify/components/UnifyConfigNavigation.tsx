"use client";

import { usePathname } from "next/navigation";
import { SecondaryNavigation } from "@/modules/ui/components/secondary-navigation";

interface UnifyConfigNavigationProps {
  environmentId: string;
  activeId?: string;
  loading?: boolean;
}

export const UnifyConfigNavigation = ({
  environmentId,
  activeId: activeIdProp,
  loading,
}: UnifyConfigNavigationProps) => {
  const pathname = usePathname();

  const activeId =
    activeIdProp ??
    (pathname?.includes("/unify/sources")
      ? "sources"
      : pathname?.includes("/unify/knowledge")
        ? "knowledge"
        : pathname?.includes("/unify/taxonomy")
          ? "taxonomy"
          : "controls");

  const baseHref = `/environments/${environmentId}/workspace/unify`;

  const navigation = [
    { id: "controls", label: "Controls", href: `${baseHref}/controls` },
    { id: "sources", label: "Sources", href: `${baseHref}/sources` },
    { id: "knowledge", label: "Knowledge", href: `${baseHref}/knowledge` },
    { id: "taxonomy", label: "Taxonomy", href: `${baseHref}/taxonomy` },
  ];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
