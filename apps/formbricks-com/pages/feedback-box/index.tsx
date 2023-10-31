import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function FeedbackBoxPage() {
  return (
    <Layout
      title="Feedback Box with Formbricks"
      description="Open a direct channel to your users by allowing them to share feedback with your team.">
      <div className="grid grid-cols-1 items-center md:grid-cols-2 md:gap-12 md:py-20">
        <div className="p-6 md:p-0">
          <UseCaseHeader title="Feedback Box" difficulty="Easy" setupMinutes="5" />
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            Why is it useful?
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Offering a direct channel for feedback helps you build a better product. Users feel heard and with
            Formbricks automations, you&apos;ll be able to react to feedback rapidly. Lastly, critical
            feedback can be acted upon quickly so that it doesn&apos;t end up on social media.
          </p>
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            How to get started:
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Setting up a Feedback Widget with Formbricks takes just a few minutes. Create an account,
            customize your widget and choose the right settings so that it always pops up when a user hits
            &quot;Feedback&quot;.
          </p>
          <UseCaseCTA href="/docs/best-practices/feedback-box" />
        </div>

        <DemoPreview template="Feedback Box" />
      </div>
      <h2 className="mb-6 ml-4 mt-12 text-2xl font-semibold text-slate-700 dark:text-slate-400 md:mt-0">
        Other Best Practices
      </h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
