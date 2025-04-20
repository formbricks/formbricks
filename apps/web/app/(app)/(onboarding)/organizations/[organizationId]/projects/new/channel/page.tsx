import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { getUserProjects } from "@/lib/project/service";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";
import { getTranslate } from "@/tolgee/server";
import { PictureInPicture2Icon, SendIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface ChannelPageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: ChannelPageProps) => {
  const params = await props.params;

  const { session } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const t = await getTranslate();
  const channelOptions = [
    {
      title: t("organizations.projects.new.channel.link_and_email_surveys"),
      description: t("organizations.projects.new.channel.link_and_email_surveys_description"),
      icon: SendIcon,
      href: `/organizations/${params.organizationId}/projects/new/settings?channel=link`,
    },
    {
      title: t("organizations.projects.new.channel.in_product_surveys"),
      description: t("organizations.projects.new.channel.in_product_surveys_description"),
      icon: PictureInPicture2Icon,
      href: `/organizations/${params.organizationId}/projects/new/settings?channel=app`,
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
          className="absolute top-5 right-5 !mt-0 text-slate-500 hover:text-slate-700"
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
