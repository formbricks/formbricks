import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoPreview from "@/components/dummyUI/DemoPreview";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function FeedbackBoxPage() {
  return (
    <Layout
      title="Feedback Box"
      description="Open a direct channel to your users by allowing them to share feedback with your team.">
      <div className="grid grid-cols-2 items-center gap-12 py-20">
        <div>
          <UseCaseHeader title="Feedback Box" difficulty="Easy" setupMinutes="5" />
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">Why is it useful?</h3>
          <p className="text-slate-600">
            Offering a direct channel for feedback helps you build a better product. Users feel heared and
            with Formbricks automations, you&apos;ll be able to react to feedback rapidly. Lastly, critical
            feedback can be acted upon quickly so that it doesn&apos; end up on social media.
          </p>
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">How to get started:</h3>
          <p className="text-slate-600">
            Setting up a Feedback Widget with Formbricks takes just a few minutes. Create an account,
            customize your widget and choose the right settings so that it always pops up when a user hits
            &quot;Feedback&quot;.
          </p>
          <UseCaseCTA href="/docs/best-practices/feedback-box" />
        </div>

        <DemoPreview template="Feedback Box" />
      </div>
      <h2 className="mb-6 ml-4 text-2xl font-semibold text-slate-700">Other Best Practices</h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
