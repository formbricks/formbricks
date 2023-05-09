import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function InterviewPromptPage() {
  return (
    <Layout
      title="Feature Chaser"
      description="Show a survey about a new feature shown only to people who used it.">
      <div className="grid grid-cols-2 items-center gap-12 py-20">
        <div>
          <UseCaseHeader title="Feature Follow-Up" difficulty="Easy" setupMinutes="10" />
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">Why is it useful?</h3>
          <p className="text-slate-600">
            You don&apos;t always know how well a feature works. Especially in complex products with a diverse
            user group, it can be difficult to gather reliable experience data. The Feature Chaser allows you
            to granularly survey users at exactly the right point in the user journey.
          </p>
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">How to get started:</h3>
          <p className="text-slate-600">
            Once you&apos;ve embedded the Formbricks Widget in your application, you can start following user
            actions. Simply use our No-Code Action wizard to keep track of different actions users perfrom -
            100% GPDR compliant.
          </p>
          <UseCaseCTA href="/docs/best-practices/feature-chaser" />
        </div>

        <DemoPreview template="Feature Chaser" />
      </div>
      <h2 className="mb-6 ml-4 text-2xl font-semibold text-slate-700">Other Best Practices</h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
