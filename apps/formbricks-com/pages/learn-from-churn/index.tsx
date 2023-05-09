import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function InterviewPromptPage() {
  return (
    <Layout
      title="Learn from Churn"
      description="Churn is hard, but insightful. Learn from users who changed their mind.">
      <div className="grid grid-cols-2 items-center gap-12 py-20">
        <div>
          <UseCaseHeader title="Learn from Churn" difficulty="Easy" setupMinutes="15" />
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">Why is it useful?</h3>
          <p className="text-slate-600">
            Churn is hard. Users decided to pay for your product or service and now changed their mind.
            Don&apos;t let them get away with these knowledge nuggets about the shortcomings of your product.
            Find out to prevent churn in the future.
          </p>
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">How to get started:</h3>
          <p className="text-slate-600">
            Once you&apos;ve setup Formbricks, you have to ways to run this survey: Before users cancel or
            after. You might add to their frustration, but getting feedback from every user gets you there
            faster.
          </p>
          <UseCaseCTA href="/docs/best-practices/cancel-subscription" />
        </div>
        <DemoPreview template="Churn Survey" />
      </div>
      <h2 className="mb-6 ml-4 text-2xl font-semibold text-slate-700">Other Best Practices</h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
