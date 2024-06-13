import { ProductSettings } from "@/app/(app)/onboarding/[environmentId]/product/settings/components/ProductSettings";
import { OnboardingTitle } from "@/app/(app)/onboarding/components/OnboardingTitle";
import { getCustomHeadline } from "@/app/(app)/onboarding/utils";
import { notFound } from "next/navigation";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";

interface ProductSettingsPageProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    channel?: string;
    industry?: string;
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
    <div className="flex min-h-full min-w-full flex-col items-center justify-center">
      {channel === "link" || industry === "other" ? (
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
      <div className="space-y-4 text-center">
        <p className="text-4xl font-medium text-slate-800"></p>
        <p className="text-sm text-slate-500">:</p>
      </div>
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
