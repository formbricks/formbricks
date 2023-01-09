import { Button } from "@formbricks/ui";
import Link from "next/link";
import { useRouter } from "next/router";
import Prism from "prismjs";
import { useEffect } from "react";
import { toast } from "react-toastify";

export default function SetupInstructions({}) {
  const router = useRouter();
  const formId = router.query.formId.toString();

  useEffect(() => {
    Prism.highlightAll();
  }, []);

  return (
    <div>
      <div className="grid grid-cols-5 gap-8 py-4">
        <div className="col-span-3 text-sm text-gray-600">
          <h3 className="block text-lg font-semibold text-slate-800">How to get started</h3>
          <ol className="mt-2 list-decimal pl-4 leading-8 text-slate-700">
            <li>
              Copy the Javascript widget below into your application and customize the config according to
              your needs.
            </li>
            <li>
              Setup the button that opens the widget with the onClick handler let your users open the widget.
            </li>
            <li>You are ready to receive your first submission and view it in the Results tab.</li>
            <li>Get notified or pipe submission data to a different tool in the Data Pipelines tab.</li>
          </ol>
        </div>
        <div className="col-span-2">
          <div>
            <label htmlFor="formId" className="block text-lg font-semibold text-slate-800">
              Your form ID
            </label>
            <div className="mt-3 w-96">
              <input
                id="formId"
                type="text"
                className="focus:border-brand focus:ring-brand block w-full rounded-md border-gray-300 shadow-sm disabled:bg-gray-100 sm:text-sm"
                value={formId}
                disabled
              />

              <Button
                variant="secondary"
                className="mt-2 w-full justify-center"
                onClick={() => {
                  navigator.clipboard.writeText(formId);
                  toast("Copied form ID to clipboard");
                }}>
                copy
              </Button>
            </div>
          </div>
        </div>
      </div>
      <hr className="my-4 text-gray-800" />
      <div className="py-6">
        <label htmlFor="formId" className="block text-lg font-semibold text-slate-800">
          Javascript Snippet
        </label>
        <p>
          Place this Javascript script tags into the head of your HTML file and include the button into the
          body to start using Formbricks Feedback.
        </p>
        <div className="mt-3">
          <div className="col-span-3 rounded-md bg-black p-4 text-sm font-light text-gray-200">
            <pre>
              <code className="language-html whitespace-pre-wrap">
                {`<!--HTML header script -->
<script src="https://cdn.jsdelivr.net/npm/@formbricks/feedback@0.1.5/dist/index.umd.js" defer></script>

<script>
window.formbricks = {
  config: {
    hqUrl: "${window.location.protocol}//${window.location.host}",
    formId: "${formId}",
  },
  ...window.formbricks,
};
</script>

<!--Button element -->
<button onclick={(e) => window.formbricks.open(e)}>Feedback</button>`}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
