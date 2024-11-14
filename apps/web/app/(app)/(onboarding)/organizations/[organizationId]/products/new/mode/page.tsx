import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { HeartIcon, ListTodoIcon, XIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { authOptions } from "@formbricks/lib/authOptions";
import { getUserProducts } from "@formbricks/lib/product/service";
import { Button } from "@formbricks/ui/components/Button";
import { Header } from "@formbricks/ui/components/Header";

interface ModePageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: ModePageProps) => {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const t = await getTranslations();
  const channelOptions = [
    {
      title: t("organizations.products.new.mode.formbricks_surveys"),
      description: t("organizations.products.new.mode.formbricks_surveys_description"),
      icon: ListTodoIcon,
      href: `/organizations/${params.organizationId}/products/new/channel`,
    },
    {
      title: t("organizations.products.new.mode.formbricks_cx"),
      description: t("organizations.products.new.mode.formbricks_cx_description"),
      icon: HeartIcon,
      href: `/organizations/${params.organizationId}/products/new/settings?mode=cx`,
    },
  ];

  const products = await getUserProducts(session.user.id, params.organizationId);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header title={t("organizations.products.new.mode.what_are_you_here_for")} />
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
