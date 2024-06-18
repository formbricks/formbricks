import { ProductSettings } from "@/app/(app)/organizations/[organizationId]/products/new/settings/components/ProductSettings";
import { notFound } from "next/navigation";
import { DEFAULT_BRAND_COLOR } from "@formbricks/lib/constants";
import { getCustomHeadline } from "@formbricks/lib/utils/strings";
import { startsWithVowel } from "@formbricks/lib/utils/strings";
import { TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";
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

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      {channel === "link" ? (
        <Header
          title="Match your brand, get 2x more responses."
          subtitle="When people recognize your brand, they are much more likely to start and complete responses."
        />
      ) : (
        <Header
          title={`You run ${startsWithVowel(customHeadline) ? "an " + customHeadline : "a " + customHeadline}, how exciting!`}
          subtitle="Get 2x more responses matching surveys with your brand and UI"
        />
      )}
      <ProductSettings
        organizationId={params.organizationId}
        channel={channel}
        industry={industry}
        defaultBrandColor={DEFAULT_BRAND_COLOR}
      />
    </div>
  );
};

export default Page;
