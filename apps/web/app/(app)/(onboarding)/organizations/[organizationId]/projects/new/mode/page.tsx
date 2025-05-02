import { OnboardingOptionsContainer } from "@/app/(app)/(onboarding)/organizations/components/OnboardingOptionsContainer";
import { getUserProjects } from "@/lib/project/service";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Header } from "@/modules/ui/components/header";
import { getTranslate } from "@/tolgee/server";
import { HeartIcon, ListTodoIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

interface ModePageProps {
  params: Promise<{
    organizationId: string;
  }>;
}

const Page = async (props: ModePageProps) => {
  const params = await props.params;

  const { session } = await getOrganizationAuth(params.organizationId);

  if (!session?.user) {
    return redirect(`/auth/login`);
  }

  const t = await getTranslate();
  const channelOptions = [
    {
      title: t("organizations.projects.new.mode.formbricks_surveys"),
      description: t("organizations.projects.new.mode.formbricks_surveys_description"),
      icon: ListTodoIcon,
      href: `/organizations/${params.organizationId}/projects/new/channel`,
    },
    {
      title: t("organizations.projects.new.mode.formbricks_cx"),
      description: t("organizations.projects.new.mode.formbricks_cx_description"),
      icon: HeartIcon,
      href: `/organizations/${params.organizationId}/projects/new/settings?mode=cx`,
    },
  ];

  const projects = await getUserProjects(session.user.id, params.organizationId);

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <Header title={t("organizations.projects.new.mode.what_are_you_here_for")} />
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
