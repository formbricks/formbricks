import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DocsFeedback from "@/components/docs/DocsFeedback";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function DocsFeedbackPage() {
  return (
    <Layout
      title="Feedback Box"
      description="The better your docs, the higher your user adoption. Measure granularly how clear your documentation is.">
      <div className="grid grid-cols-2 items-center gap-12 py-20">
        <div>
          <UseCaseHeader title="Docs Feedback" difficulty="Intermediate" setupMinutes="30" />
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">Why is it useful?</h3>
          <p className="text-slate-600">
            You want to know if your Developer Docs are clear and concise. When engineers don’t understand
            your technology or find the answer to their question, they are unlikely to use it. Docs Feedback
            gives you a window into how clear your Docs are.
          </p>
          <h3 className="text-md text-slate-80 mb-1.5 mt-6 font-semibold">How to get started:</h3>
          <p className="text-slate-600">
            As of now, Docs Feedback uses custom UI in the frontend and Formbricks in the backend. A partial
            submission is sent when the user answers YES / NO and is enriched when the open text field is
            filled out and submitted. If you&apos;re using next.js you can copy our UI :)
          </p>
          <UseCaseCTA href="/docs/best-practices/docs-feedback" />
        </div>
        <div className="flex items-center justify-center rounded-xl border-2 border-slate-300 bg-slate-200 pb-36 transition-transform duration-150">
          <div className="my-6 flex flex-col items-center justify-around">
            <p className="my-3 text-sm text-slate-500">Preview</p>
            <DocsFeedback />
          </div>
        </div>
      </div>
      <h2 className="mb-6 ml-4 text-2xl font-semibold text-slate-700">Other Best Practices</h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
