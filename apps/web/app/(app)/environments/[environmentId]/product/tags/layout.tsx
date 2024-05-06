import ProductConfigTabs from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigTabs";
import { Metadata } from "next";

import { InnerContentWrapper } from "@formbricks/ui/InnerContentWrapper";

export const metadata: Metadata = {
  title: "Config",
};

export default async function ConfigLayout({ children, params }) {
  return (
    <div className="flex">
      <ProductConfigTabs activeId="tags" environmentId={params.environmentId} />
      <InnerContentWrapper pageTitle="Configuration">{children}</InnerContentWrapper>
    </div>
  );
}
