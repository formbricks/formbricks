import Layout from "@/components/shared/Layout";
import UseCaseHeader from "@/components/shared/UseCaseHeader";
import UseCaseCTA from "@/components/shared/UseCaseCTA";
import DocsFeedback from "@/components/docs/DocsFeedback";
import BestPracticeNavigation from "@/components/shared/BestPracticeNavigation";

export default function DocsFeedbackPage() {
  return (
    <Layout
      title="Get User Feedback in the easiest way possible with Formbricks"
      description="The better your docs, the higher your user adoption. Measure granularly how clear your documentation is.">
      <div className="grid grid-cols-1 items-center md:grid-cols-2 md:gap-12 md:py-20">
        <div className="p-6 md:p-0">
          <UseCaseHeader title="Docs Feedback" difficulty="Intermediate" setupMinutes="60" />
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            Why is it useful?
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            You want to know if your Developer Docs are clear and concise. When engineers don’t understand
            your technology or find the answer to their question, they are unlikely to use it. Docs Feedback
            opens a window into how clear your Docs are. Have a look!
          </p>
          <h3 className="text-md mb-1.5 mt-6 font-semibold text-slate-800 dark:text-slate-200">
            How to get started:
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            As of now, Docs Feedback uses custom UI in the frontend and Formbricks in the backend. A partial
            submission is sent when the user answers YES / NO and is enriched when the open text field is
            filled out and submitted.
          </p>
          <UseCaseCTA href="/docs/best-practices/docs-feedback" />
        </div>
        <div className="mx-6 my-6 flex flex-col items-center justify-center rounded-xl border-2 border-slate-300 bg-slate-200 p-4 pb-36 transition-transform duration-150 dark:border-slate-500 dark:bg-slate-700 md:mx-0">
          <p className="my-3 text-sm text-slate-500">Preview</p>
          <DocsFeedback />
        </div>
      </div>
      <h2 className="mb-6 ml-4 mt-12 text-2xl font-semibold text-slate-700 dark:text-slate-400 md:mt-0">
        Other Best Practices
      </h2>
      <BestPracticeNavigation />
    </Layout>
  );
}
