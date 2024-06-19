import { OnboardingOptionsContainer } from "@/app/(app)/organizations/components/OnboardingOptionsContainer";
import { HeartIcon, MonitorIcon, ShoppingCart, XIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getProducts } from "@formbricks/lib/product/service";
import { TProductConfigChannel } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
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

  const products = await getProducts(params.organizationId);

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
