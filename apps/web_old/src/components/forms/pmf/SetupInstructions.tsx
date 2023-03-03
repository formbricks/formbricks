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
      <div className="max-w-8xl mx-auto grid grid-cols-5 gap-16 py-8">
        <div className="col-span-3">
          <div>
            <div className="mb-6">
              <h2 className="mb-3 text-3xl font-bold text-slate-800">Quick Start Guide</h2>
              <p>You add the PMF Survey with a JavaScript embed:</p>
            </div>

            <div>
              <h3 className="block text-xl font-semibold text-slate-800">Javascript Embed</h3>
              <ol className="mt-2 list-decimal pl-4 leading-8 text-slate-700">
                <li>Copy the Javascript snippet below into the HEAD of your HTML file.</li>
                <li>Set up a button with the onClick handler below to let your users open the widget.</li>
                <li>
                  Set up the config file according to your needs.{" "}
                  <a
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-dark font-bold underline"
                    href="https://formbricks.com/docs/best-practices/pmf-survey">
                    Read the docs
                  </a>{" "}
                  for more info.
                </li>
                <li>You&apos;re done! Your submissions will show up in the Responses tab.</li>
              </ol>
              <div className="mt-6">
                <h4 className="mb-2 block text-lg font-semibold text-slate-800">
                  Add to HTML &#60;head&#62;{" "}
                </h4>
                <div className="col-span-3 rounded-md bg-black p-4 text-sm font-light text-slate-200">
                  <pre>
                    <code className="language-html whitespace-pre-wrap">
                      {`<!-- HTML header script -->
<script src="https://cdn.jsdelivr.net/npm/@formbricks/pmf@0.1" defer></script>

<script>
window.formbricksPmf = {
  ...window.formbricksPmf,
  config: {
    formbricksUrl: "${window.location.protocol}//${window.location.host}",
    formId: "${formId}",
    containerId: "formbricks-pmf",
  },
};
</script>`}
                    </code>
                  </pre>
                </div>
              </div>

              <div className="mt-3">
                <h4 className="my-2 block text-lg font-semibold text-slate-800">
                  Add div with corresponding id
                </h4>
                <div className="col-span-3 rounded-md bg-black p-4 text-sm font-light text-slate-200">
                  <pre>
                    <code className="language-html whitespace-pre-wrap">
                      {`
<!-- Element to hold the survey -->
<div id="formbricks-pmf"></div>`}
                    </code>
                  </pre>
                </div>
              </div>
              <div className="mt-3">
                <h4 className="my-2 block text-lg font-semibold text-slate-800">Read full manual</h4>

                <Button
                  variant="highlight"
                  target="_blank"
                  className="mt-2"
                  href="https://formbricks.com/docs/best-practices/pmf-survey">
                  PMF Survey Docs
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-2">
          <div className="rounded-lg bg-slate-100 p-8">
            <label htmlFor="formId" className="block text-xl font-bold text-slate-800">
              Your PMF Survey ID
            </label>
            <div className="mt-3">
              <input
                id="formId"
                type="text"
                className="focus:border-brand focus:ring-brand block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100 sm:text-sm"
                value={formId}
                disabled
              />

              <Button
                variant="primary"
                className="mt-2 w-full justify-center"
                onClick={() => {
                  navigator.clipboard.writeText(formId);
                  toast("Copied form ID to clipboard");
                }}>
                Copy to clipboard
              </Button>
            </div>
            <div className="mt-10">
              <h4 className="my-2 block text-xl font-semibold text-slate-800">PMF Survey Docs</h4>
              <p>Get detailed instructions in our Docs:</p>
              <Button
                variant="secondary"
                target="_blank"
                className="mt-2 w-full justify-center"
                href="https://formbricks.com/docs/best-practices/pmf-survey">
                Documentation
              </Button>
            </div>
            <div className="mt-10">
              <h4 className="my-2 block text-xl font-semibold text-slate-800">Need help? Join Discord!</h4>
              <p>Got a question? We&apos;re happy to help:</p>
              <Button
                variant="secondary"
                target="_blank"
                className="bg-purple mt-2 w-full justify-center"
                href="https://formbricks.com/discord">
                Join Discord
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    /* 


    <div>
      <div className="grid grid-cols-5 gap-8 py-4">
        <div className="col-span-3 text-sm text-slate-600">
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
            <li>You are ready to receive your first submission and view it in the Responses tab.</li>
            <li>Get notified or pipe submission data to to Slack or Email in the Data Pipelines tab.</li>
          </ol>
        </div>
        <div className="col-span-2">
          <div>
            <label htmlFor="formId" className="block text-lg font-semibold text-slate-800">
              Your PMF Survey ID
            </label>
            <div className="mt-3 w-96">
              <input
                id="formId"
                type="text"
                className="focus:border-brand focus:ring-brand block w-full rounded-md border-slate-300 shadow-sm disabled:bg-slate-100 sm:text-sm"
                value={formId}
                disabled
              />

              <Button
                variant="primary"
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
      <hr className="my-4 text-slate-800" />
      <div className="py-6">
        <label htmlFor="formId" className="block text-lg font-semibold text-slate-800">
          Javascript Snippet
        </label>
        <p>
          Place this Javascript script tags into the head of your HTML file and include the HTML element to
          hold the survey into the body to start using the Formbricks PMF survey.
        </p>
        <div className="mt-3">
          <div className="col-span-3 rounded-md bg-black p-4 text-sm font-light text-slate-200">
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
    </div> */
  );
}
