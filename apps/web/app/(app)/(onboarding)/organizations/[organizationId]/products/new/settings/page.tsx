import { getCustomHeadline } from "@/app/(app)/(onboarding)/lib/utils";
import { ProductSettings } from "@/app/(app)/(onboarding)/organizations/[organizationId]/products/new/settings/components/ProductSettings";
import { XIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { DEFAULT_BRAND_COLOR } from "@formbricks/lib/constants";
import { getProducts } from "@formbricks/lib/product/service";
import { startsWithVowel } from "@formbricks/lib/utils/strings";
import { TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Header } from "@formbricks/ui/Header";

interface ProductSettingsPageProps {
  params: {
    organizationId: string;
  };
  searchParams: {
    channel?: TProductConfigChannel;
    industry?: TProductConfigIndustry;
  };
}

const Page = async ({ params, searchParams }: ProductSettingsPageProps) => {
  const channel = searchParams.channel;
  const industry = searchParams.industry;
  if (!channel || !industry) return notFound();
  const customHeadline = getCustomHeadline(channel, industry);
  const products = await getProducts(params.organizationId);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      {channel === "link" ? (
        <Header
          title="Match your brand, get 2x more responses."
          subtitle="When people recognize your brand, they are much more likely to start and complete responses."
        />
      ) : (
        <Header
          title={`You maintain ${startsWithVowel(customHeadline) ? "an " + customHeadline : "a " + customHeadline}, how exciting!`}
          subtitle="Get 2x more responses matching surveys with your brand and UI"
        />
      )}
      <ProductSettings
        organizationId={params.organizationId}
        channel={channel}
        industry={industry}
        defaultBrandColor={DEFAULT_BRAND_COLOR}
      />
      {products.length >= 1 && (
        <Button
          className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
          variant="minimal"
          href={"/"}>
          <XIcon className="h-7 w-7" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );
};

export default Page;
