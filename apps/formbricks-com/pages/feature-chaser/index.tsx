import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function FeatureChaserPage() {
  return (
    <Layout
      title="Feature Chaser with Formbricks"
      description="Show a survey about a new feature shown only to people who used it and gain insightful data.">
      <div className="grid grid-cols-1 items-center md:grid-cols-2 md:gap-12 md:py-20">
        <div className="p-6 md:p-0">
          <UseCaseHeader title="Feature Chaser" difficulty="Easy" setupMinutes="10" />
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            Why is it useful?
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            You don&apos;t always know how well a feature works. Product analytics don&apos;t tell you why it
            is used - and why not. Especially in complex products it can be difficult to gather reliable
            experience data. The Feature Chaser allows you to granularly survey users at exactly the right
            point in the user journey.
          </p>
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            How to get started:
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Once you&apos;ve embedded the Formbricks Widget in your application, you can start following user
            actions. Simply use our No-Code Action wizard to keep track of different actions users perfrom -
            100% GPDR compliant.
          </p>
          <UseCaseCTA href="/docs/best-practices/feature-chaser" />
        </div>

        <DemoPreview template="Feature Chaser" />
      </div>
      <h2 className="mb-6 ml-4 mt-12 text-2xl font-semibold text-slate-700 dark:text-slate-400 md:mt-0">
        Other Best Practices
      </h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
