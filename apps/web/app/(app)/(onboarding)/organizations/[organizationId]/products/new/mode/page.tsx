import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { HeartIcon, ListTodoIcon, XIcon } from "lucide-react";
import { getProducts } from "@formbricks/lib/product/service";
import { Button } from "@formbricks/ui/Button";
import { Header } from "@formbricks/ui/Header";

interface ModePageProps {
  params: {
    organizationId: string;
  };
}

const Page = async ({ params }: ModePageProps) => {
  const channelOptions = [
    {
      title: "Formbricks Surveys",
      description: "Multi-purpose survey platform for web, app and email surveys.",
      icon: ListTodoIcon,
      href: `/organizations/${params.organizationId}/products/new/channel`,
    },
    {
      title: "Formbricks CX",
      description: "Surveys and reports to understand what your customers need.",
      icon: HeartIcon,
      href: `/organizations/${params.organizationId}/products/new/settings?mode=cx`,
    },
  ];

  const products = await getProducts(params.organizationId);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header title="What are you here for?" />
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
