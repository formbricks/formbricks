import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function LearnFromChurnPage() {
  return (
    <Layout
      title="Learn from Churn with Formbricks"
      description="Churn is hard, but insightful. Learn from users who changed their mind.">
      <div className="grid grid-cols-1 items-center md:grid-cols-2 md:gap-12 md:py-20">
        <div className="p-6 md:p-0">
          <UseCaseHeader title="Learn from Churn" difficulty="Easy" setupMinutes="15" />
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            Why is it useful?
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Churn is hard. Users decided to pay for your service and changed their mind. Don&apos;t let them
            get away with these knowledge nuggets about the shortcomings of your product! Find out to prevent
            churn in the future.
          </p>
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            How to get started:
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Once you&apos;ve setup Formbricks, you have two ways to run this survey: Before users cancel or
            after. If you guide them through the survey before they can cancel, you might add to their
            frustration. But getting feedback from every user gets you there faster.
          </p>
          <UseCaseCTA href="/docs/best-practices/cancel-subscription" />
        </div>
        <DemoPreview template="Churn Survey" />
      </div>
      <h2 className="mb-6 ml-4 mt-12 text-2xl font-semibold text-slate-700 dark:text-slate-400 md:mt-0">
        Other Best Practices
      </h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
