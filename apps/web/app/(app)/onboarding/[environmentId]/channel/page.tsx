import { OnboardingOptionsContainer } from "@/app/(app)/onboarding/components/OnboardingOptionsContainer";
import { OnboardingTitle } from "@/app/(app)/onboarding/components/OnboardingTitle";
import { CircleUserRoundIcon, EarthIcon, SendHorizonalIcon } from "lucide-react";

interface ChannelPageProps {
  params: {
    environmentId: string;
  };
}

const Page = async ({ params }: ChannelPageProps) => {
  const channelOptions = [
    {
      title: "Public Website",
      description: "Display surveys on any website event, target with anonymus attributes.",
      icon: EarthIcon,
      iconText: "Built for scale",
      href: `/onboarding/${params.environmentId}/industry?channel=website`,
    },
    {
      title: "App with Sign Up",
      description: "Run highly targeted micro-surveys with any user cohort",
      icon: CircleUserRoundIcon,
      iconText: "Enrich user profiles",
      href: `/onboarding/${params.environmentId}/industry?channel=app`,
    },
    {
      channel: "link",
      title: "Anywhere online",
      description: "Create link and email surveys, reach your people anywhere",
      icon: SendHorizonalIcon,
      iconText: "100% custom branding",
      href: `/onboarding/${params.environmentId}/industry?channel=link`,
    },
  ];

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center">
      <OnboardingTitle
        title="Where do you want to survey people?"
        subtitle="Get started with proven Best Practices 🚀"
      />
      <OnboardingOptionsContainer options={channelOptions} />
    </div>
  );
};

export default Page;
