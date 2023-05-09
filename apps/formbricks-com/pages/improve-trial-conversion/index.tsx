import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function InterviewPromptPage() {
  return (
    <Layout
      title="Improve Trial Conversion"
      description="Take the guessing out, convert more trials to paid users with insights.">
      <div className="grid grid-cols-2 items-center items-center gap-12 py-20">
        <div>
          <UseCaseHeader title="Improve Trial Conversion" difficulty="Easy" setupMinutes="15" />
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">Why is it useful?</h3>
          <p className="text-slate-600">
            People who tried your product have the problem you&apos;re solving. That&apos;s good!
            Understanding why they didn&apos;t convert to a paying user is crucial to improve your conversion
            rate - and grow the bottom line of your company.
          </p>
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">How to get started:</h3>
          <p className="text-slate-600">
            Once a user signed up for a trial, you can pass this attribute to Formbricks. This allows you to
            pre-segment your user base and only survey users in their trial stage. This granular segmentation
            leads to better data.
          </p>
          <UseCaseCTA href="/docs/best-practices/missed-trial" />
        </div>
        <DemoPreview template="Missed Trial Conversion" />
      </div>
      <h2 className="mb-6 ml-4 text-2xl font-semibold text-slate-700">Other Best Practices</h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
