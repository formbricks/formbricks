import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";
import { GlobeIcon, GlobeLockIcon, LinkIcon, XIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserProjects } from "@formbricks/lib/project/service";

interface ChannelPageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: ChannelPageProps) => {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return redirect(`/auth/login`);
  }

  const t = await getTranslations();
  const channelOptions = [
    {
      title: t("organizations.projects.new.channel.public_website"),
      description: t("organizations.projects.new.channel.public_website_description"),
      icon: GlobeIcon,
      iconText: t("organizations.projects.new.channel.public_website_icon_text"),
      href: `/organizations/${params.organizationId}/projects/new/settings?channel=website`,
    },
    {
      title: t("organizations.projects.new.channel.app_with_sign_up"),
      description: t("organizations.projects.new.channel.app_with_sign_up_description"),
      icon: GlobeLockIcon,
      iconText: t("organizations.projects.new.channel.app_with_sign_up_icon_text"),
      href: `/organizations/${params.organizationId}/projects/new/settings?channel=app`,
    },
    {
      channel: "link",
      title: t("organizations.projects.new.channel.link_and_email_surveys"),
      description: t("organizations.projects.new.channel.link_and_email_surveys_description"),
      icon: LinkIcon,
      iconText: t("organizations.projects.new.channel.link_and_email_surveys_icon_text"),
      href: `/organizations/${params.organizationId}/projects/new/settings?channel=link`,
    },
  ];

  const projects = await getUserProjects(session.user.id, params.organizationId);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header
        title={t("organizations.projects.new.channel.channel_select_title")}
        subtitle={t("organizations.projects.new.channel.channel_select_subtitle")}
      />
      <OnboardingOptionsContainer options={channelOptions} />
      {projects.length >= 1 && (
        <Button
          className="absolute right-5 top-5 !mt-0 text-slate-500 hover:text-slate-700"
          variant="ghost"
          asChild>
          <Link href={"/"}>
            <XIcon className="h-7 w-7" strokeWidth={1.5} />
          </Link>
        </Button>
      )}
    </div>
  );
};

export default Page;
