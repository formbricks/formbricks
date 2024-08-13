import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { GlobeIcon, GlobeLockIcon, LinkIcon, XIcon } from "lucide-react";
import { getProducts } from "@formbricks/lib/product/service";
import { Button } from "@formbricks/ui/Button";
import { Header } from "@formbricks/ui/Header";

interface ChannelPageProps {
  params: {
    organizationId: string;
  };
}

const Page = async ({ params }: ChannelPageProps) => {
  const channelOptions = [
    {
      title: "Public website",
      description: "Run well-timed pop-up surveys.",
      icon: GlobeIcon,
      iconText: "Built for scale",
      href: `/organizations/${params.organizationId}/products/new/industry?channel=website`,
    },
    {
      title: "App with sign up",
      description: "Run highly-targeted micro-surveys.",
      icon: GlobeLockIcon,
      iconText: "Enrich user profiles",
      href: `/organizations/${params.organizationId}/products/new/industry?channel=app`,
    },
    {
      channel: "link",
      title: "Link & email surveys",
      description: "Reach people anywhere online.",
      icon: LinkIcon,
      iconText: "Anywhere online",
      href: `/organizations/${params.organizationId}/products/new/industry?channel=link`,
    },
  ];

  const products = await getProducts(params.organizationId);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header
        title="Where do you want to survey people?"
        subtitle="Run surveys on public websites, in your app, or with shareable links & emails."
      />
      <OnboardingOptionsContainer options={channelOptions} />
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
