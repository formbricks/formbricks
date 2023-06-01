import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function InterviewPromptPage() {
  return (
    <Layout
      title="Interview Prompt"
      description="Ask only power users users to book a time in your calendar. Get those juicy details.">
      <div className="grid grid-cols-1 items-center md:grid-cols-2 md:gap-12 md:py-20">
        <div className="p-6 md:p-0">
          <UseCaseHeader title="Interview Prompt" difficulty="Easy" setupMinutes="15" />
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            Why is it useful?
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Interviews are the best way to understand your customers needs. But there is so much overhead
            involved, especially when your team and customer base grow. Automate scheduling interviews with
            Formbricks with ease.
          </p>
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            How to get started:
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Once you have setup the Formbricks Widget, you have two ways to pre-segment your user base: Based
            on events and based on attributes. Soon, you will also be able to import cohorts from PostHog with
            just a few clicks.
          </p>
          <UseCaseCTA href="/docs/best-practices/interview-prompt" />
        </div>
        <DemoPreview template="Interview Prompt" />
      </div>
      <h2 className="mb-6 ml-4 mt-12 text-2xl font-semibold text-slate-700 dark:text-slate-400 md:mt-0">
        Other Best Practices
      </h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
