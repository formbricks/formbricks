import { OnboardingTitle } from "@/app/(app)/onboarding/components/OnboardingTitle";

const Page = async () => {
  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-12">
      <OnboardingTitle
        title="Onboarding Pending! 🙁"
        subtitle="Please wait until the product onboarding was finished by the team."
      />
    </div>
  );
};

export default Page;
