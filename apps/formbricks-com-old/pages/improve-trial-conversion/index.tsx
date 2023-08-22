import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function MissedTrialPagePage() {
  return (
    <Layout
      title="Improve Trial Conversion"
      description="Take the guessing out, convert more trials to paid users with insights.">
      <div className="grid grid-cols-1 items-center md:grid-cols-2 md:gap-12 md:py-20">
        <div className="p-6 md:p-0">
          <UseCaseHeader title="Improve Trial Conversion" difficulty="Easy" setupMinutes="15" />
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            Why is it useful?
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            People who tried your product have the problem you&apos;re solving. That&apos;s good!
            Understanding why they didn&apos;t convert to a paying user is crucial to improve your conversion
            rate - and grow the bottom line of your company.
          </p>
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            How to get started:
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Once a user signed up for a trial, you can pass this info as an attribute to Formbricks. This
            allows you to pre-segment your user base and only survey users in the trial stage. This granular
            segmentation leads to better data and minimal survey fatigue.
          </p>
          <UseCaseCTA href="/docs/best-practices/improve-trial-cr" />
        </div>
        <DemoPreview template="Improve Trial Conversion" />
      </div>
      <h2 className="mb-6 ml-4 mt-12 text-2xl font-semibold text-slate-700 dark:text-slate-400 md:mt-0">
        Other Best Practices
      </h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
