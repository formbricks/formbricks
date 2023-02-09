import { Button } from "@formbricks/ui";
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
            <li>Copy the Javascript widget below into your application</li>
            <li>
              Customize the config according to your needs.{" "}
              <a
                className="text-brand font-bold underline"
                href="https://formbricks.com/docs/best-practices/pmf-survey">
                Read the docs
              </a>{" "}
              for more info.
            </li>
            <li>
              Choose an HTML element which you want to replace with the PMF survey. Set a unique ID for this
              element and configure the script accordingly.
            </li>
            <li>You are ready to receive your first submission and view it in the Results tab.</li>
            <li>Get notified or pipe submission data to to Slack or Email in the Data Pipelines tab.</li>
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
          Place this Javascript script tags into the head of your HTML file and include the HTML element to
          hold the survey into the body to start using the Formbricks PMF survey.
        </p>
        <div className="mt-3">
          <div className="col-span-3 rounded-md bg-black p-4 text-sm font-light text-gray-200">
            <pre>
              <code className="language-html whitespace-pre-wrap">
                {`<!-- HTML header script -->
<script src="https://cdn.jsdelivr.net/npm/@formbricks/pmf@0.1.0/dist/index.umd.js" defer></script>

<script>
window.formbricks = {
  ...window.formbricks,
  config: {
    formbricksUrl: "${window.location.protocol}//${window.location.host}",
    formId: "${formId}",
    containerId: "formbricks-container",
  },
};
</script>

<!-- Element to hold the survey -->
<div id="formbricks-container"></div>`}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
