import { OnboardingOptionsContainer } from "@/app/(app)/organizations/components/OnboardingOptionsContainer";
import { HeartIcon, MonitorIcon, ShoppingCart } from "lucide-react";
import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { TProductConfigChannel } from "@formbricks/types/product";
import { Header } from "@formbricks/ui/Header";

interface IndustryPageProps {
  params: {
    organizationId: string;
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
      description: "Implement proven best practices to understand why people buy.",
      icon: ShoppingCart,
      iconText: "B2B and B2C",
      href: `/organizations/${params.organizationId}/products/new/settings?channel=${channel}&industry=eCommerce`,
    },
    {
      title: "SaaS",
      description: "Gather contextualized feedback to improve product-market fit.",
      icon: MonitorIcon,
      iconText: "Proven methods",
      href: `/organizations/${params.organizationId}/products/new/settings?channel=${channel}&industry=saas`,
    },
    {
      title: "Other",
      description: "Universal Formricks experience with features for every industry.",
      icon: HeartIcon,
      iconText: "Customer insights",
      href: IS_FORMBRICKS_CLOUD
        ? `/organizations/${params.organizationId}/products/new/survey?channel=${channel}&industry=other`
        : `/organizations/${params.organizationId}/products/new/settings?channel=${channel}&industry=other`,
    },
  ];

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header title="Which industry do you work for?" subtitle="Get started with proven best practices 🚀" />
      <OnboardingOptionsContainer options={industryOptions} />
    </div>
  );
};

export default Page;
