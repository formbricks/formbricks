import { OnboardingOptionsContainer } from "@/app/(app)/onboarding/components/OnboardingOptionsContainer";
import { OnboardingTitle } from "@/app/(app)/onboarding/components/OnboardingTitle";
import { HeartIcon, MonitorIcon, ShoppingCart } from "lucide-react";
import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { TProductConfigChannel } from "@formbricks/types/product";

interface IndustryPageProps {
  params: {
    environmentId: string;
  };
  searchParams: {
    channel?: TProductConfigChannel;
  };
}

const Page = async ({ params, searchParams }: IndustryPageProps) => {
  const channel = searchParams.channel;
  if (!channel) {
    return notFound();
  }

  const industryOptions = [
    {
      title: "E-Commerce",
      description: "Implement proven best practices to understand WHY people buy.",
      icon: ShoppingCart,
      iconText: "B2B and B2C",
      href: `/onboarding/${params.environmentId}/product/settings?channel=${channel}&industry=eCommerce`,
    },
    {
      title: "SaaS",
      description: "Leverage every touchpoint to gather feedback for better product-market fit",
      icon: MonitorIcon,
      iconText: "Keep 'em happy",
      href: `/onboarding/${params.environmentId}/product/settings?channel=${channel}&industry=saas`,
    },
    {
      title: "Other",
      description: "Universal Formricks experience with features for every industry",
      icon: HeartIcon,
      iconText: "Universal",
      href: IS_FORMBRICKS_CLOUD
        ? `/onboarding/${params.environmentId}/survey?channel=${channel}&industry=other`
        : `/onboarding/${params.environmentId}/product/settings?channel=${channel}&industry=other`,
    },
  ];

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center">
      <OnboardingTitle
        title="Which industry do you work for?"
        subtitle="Get started with proven Best Practices 🚀"
      />
      <OnboardingOptionsContainer options={industryOptions} />
    </div>
  );
};

export default Page;
