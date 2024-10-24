import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { GlobeIcon, GlobeLockIcon, LinkIcon, XIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getProducts } from "@formbricks/lib/product/service";
import { Button } from "@formbricks/ui/components/Button";
import { Header } from "@formbricks/ui/components/Header";

interface ChannelPageProps {
  params: {
    organizationId: string;
  };
}

const Page = async ({ params }: ChannelPageProps) => {
  const t = await getTranslations();
  const channelOptions = [
    {
      title: t("organizations.products.new.channel.public_website"),
      description: t("organizations.products.new.channel.public_website_description"),
      icon: GlobeIcon,
      iconText: t("organizations.products.new.channel.public_website_icon_text"),
      href: `/organizations/${params.organizationId}/products/new/settings?channel=website`,
    },
    {
      title: t("organizations.products.new.channel.app_with_sign_up"),
      description: t("organizations.products.new.channel.app_with_sign_up_description"),
      icon: GlobeLockIcon,
      iconText: t("organizations.products.new.channel.app_with_sign_up_icon_text"),
      href: `/organizations/${params.organizationId}/products/new/settings?channel=app`,
    },
    {
      channel: "link",
      title: t("organizations.products.new.channel.link_and_email_surveys"),
      description: t("organizations.products.new.channel.link_and_email_surveys_description"),
      icon: LinkIcon,
      iconText: t("organizations.products.new.channel.link_and_email_surveys_icon_text"),
      href: `/organizations/${params.organizationId}/products/new/settings?channel=link`,
    },
  ];

  const products = await getProducts(params.organizationId);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header
        title={t("organizations.products.new.channel.channel_select_title")}
        subtitle={t("organizations.products.new.channel.channel_select_subtitle")}
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
