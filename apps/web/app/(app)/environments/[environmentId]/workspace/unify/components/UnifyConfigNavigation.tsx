"use client";

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
  const baseHref = `/environments/${environmentId}/workspace/unify`;

  const activeId = activeIdProp ?? "sources";

  const navigation = [{ id: "sources", label: "Sources", href: `${baseHref}/sources` }];

  return <SecondaryNavigation navigation={navigation} activeId={activeId} loading={loading} />;
};
