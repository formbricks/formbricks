import { CancelProductCreation } from "@/app/(app)/onboarding/[environmentId]/channel/components/CancelProductCreation";
import { OnboardingOptionsContainer } from "@/app/(app)/onboarding/components/OnboardingOptionsContainer";
import { OnboardingTitle } from "@/app/(app)/onboarding/components/OnboardingTitle";
import { CircleUserRoundIcon, EarthIcon, SendHorizonalIcon } from "lucide-react";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { getProductByEnvironmentId, getProducts } from "@formbricks/lib/product/service";

interface ChannelPageProps {
  params: {
    environmentId: string;
  };
}

const Page = async ({ params }: ChannelPageProps) => {
  const channelOptions = [
    {
      title: "Public website",
      description: "Display surveys on public websites, well timed and targeted.",
      icon: EarthIcon,
      iconText: "Built for scale",
      href: `/onboarding/${params.environmentId}/industry?channel=website`,
    },
    {
      title: "App with sign up",
      description: "Run highly targeted surveys with any user cohort.",
      icon: CircleUserRoundIcon,
      iconText: "Enrich user profiles",
      href: `/onboarding/${params.environmentId}/industry?channel=app`,
    },
    {
      channel: "link",
      title: "Anywhere online",
      description: "Create link and email surveys, reach your people anywhere.",
      icon: SendHorizonalIcon,
      iconText: "100% custom branding",
      href: `/onboarding/${params.environmentId}/industry?channel=link`,
    },
  ];

  const [organization, product] = await Promise.all([
    getOrganizationByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
  ]);
  if (!organization) {
    throw new Error("Organization not found");
  }
  if (!product) {
    throw new Error("Product not found");
  }
  const products = await getProducts(organization.id);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <OnboardingTitle
        title="Where do you want to survey people?"
        subtitle="Get started with proven best practices 🚀"
      />
      <OnboardingOptionsContainer options={channelOptions} />
      {products.length > 1 && (
        <CancelProductCreation environmentId={params.environmentId} productId={product.id} />
      )}
    </div>
  );
};

export default Page;
