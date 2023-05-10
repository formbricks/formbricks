import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function OnboardingSegmentationPage() {
  return (
    <Layout
      title="Onboarding Segmentation"
      description="Add a survey to your onboarding to loop in Formbricks right from the start.">
      <div className="grid grid-cols-2 items-center gap-12 py-20">
        <div>
          <UseCaseHeader title="Onboarding Segments" difficulty="Advanced" setupMinutes="90" />
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">Why is it useful?</h3>
          <p className="text-slate-600">
            In your Onboarding you likely want to ask two or three questions to be able to segment your users
            best. These attributes can be used to create cohorts and survey users down the line. You can
            identify who uses your product most and use Formbricks to gather relevant qualitative data on
            scale.
          </p>
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">How to get started:</h3>
          <p className="text-slate-600">
            Onboardings are unique to every product. Formbricks does not help you build the right onboarding.
            Currently, you can use the Formbricks API to send survey data to Formbricks for later usage. Down
            the line, we might offer a simple way to add survey questions to your Onboarding.
          </p>
        </div>

        <DemoPreview template="Onboarding Segmentation" />
      </div>
      <h2 className="mb-6 ml-4 text-2xl font-semibold text-slate-700">Other Best Practices</h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
