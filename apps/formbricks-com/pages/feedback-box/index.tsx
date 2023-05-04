import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DemoFeedbackBox from "@/components/dummyUI/DemoFeedbackBox";

export default function FeedbackBoxPage() {
  return (
    <Layout
      title="Feedback Box"
      description="Open a direct channel to your users by allowing them to share feedback with your team.">
      <div className="grid grid-cols-2 py-24">
        <div>
          <UseCaseHeader
            title="Feedback Box"
            description="Direct channel for users to provide feedback to your team."
            difficulty="Easy"
            setupMinutes="5"
          />
          <UseCaseCTA href="/docs/best-practices/feedback-box" />
        </div>
        <div className="flex items-center justify-center rounded-xl bg-slate-200 transition-transform duration-150">
          <DemoFeedbackBox />
        </div>
      </div>
    </Layout>
  );
}
