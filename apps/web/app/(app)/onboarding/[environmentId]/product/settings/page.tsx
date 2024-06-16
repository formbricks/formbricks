import { ProductSettings } from "@/app/(app)/onboarding/[environmentId]/product/settings/components/ProductSettings";
import { OnboardingTitle } from "@/app/(app)/onboarding/components/OnboardingTitle";
import { getCustomHeadline } from "@/app/(app)/onboarding/utils";
import { notFound } from "next/navigation";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { TProductConfigChannel, TProductConfigIndustry } from "@formbricks/types/product";

interface ProductSettingsPageProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    channel?: TProductConfigChannel;
    industry?: TProductConfigIndustry;
  };
}

const Page = async ({ params, searchParams }: ProductSettingsPageProps) => {
  const channel = searchParams.channel;
  const industry = searchParams.industry;
  const product = await getProductByEnvironmentId(params.environmentId);
  if (!channel || !industry) return notFound();
  const customHeadline = getCustomHeadline(channel, industry);

  if (!product) {
    throw new Error("Product not Found");
  }

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      {channel === "link" ? (
        <OnboardingTitle
          title="Match your brand, get 2x more responses."
          subtitle="When people recognize your brand, they are much more likely to start and complete responses."
        />
      ) : (
        <OnboardingTitle
          title={`You run a ${customHeadline}, how exciting!`}
          subtitle="Get 2x more responses matching surveys with your brand and UI"
        />
      )}
      <ProductSettings
        environmentId={params.environmentId}
        channel={channel}
        industry={industry}
        product={product}
      />
    </div>
  );
};

export default Page;
