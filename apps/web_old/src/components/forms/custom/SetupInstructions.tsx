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
            <div className="grid grid-cols-1 gap-8 py-4">
              <div>
                <div>
                  <label htmlFor="formId" className="block text-lg font-semibold text-slate-800">
                    Capture POST Url:
                  </label>
                  <div className="mt-3">
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-200 px-3 text-slate-500  sm:text-sm">
                        POST
                      </span>
                      <input
                        id="captureUrl"
                        type="text"
                        className="focus:border-brand focus:ring-brand block w-full rounded-r-md border-slate-300 bg-slate-100 shadow-sm sm:text-sm"
                        value={`${window.location.protocol}//${window.location.host}/api/capture/forms/${formId}/submissions`}
                        disabled
                      />
                    </div>

                    <Button
                      variant="secondary"
                      className="mt-2 w-full justify-center"
                      onClick={() => {
                        navigator.clipboard.writeText(formId);
                        toast("Copied form url to clipboard");
                      }}>
                      copy
                    </Button>
                  </div>
                </div>
                <div className="mt-4 rounded-md bg-black p-4 font-light text-slate-200 first-letter:text-sm">
                  <pre>
                    <code className="language-js whitespace-pre-wrap">
                      {`{
"customer": {
  "email": "user@example.com",
},
"data": {
  "firstname": "John",
  "lastname": "Doe",
  "feedback": "I like the app very much"
  }
}`}
                    </code>
                  </pre>
                </div>
              </div>
              <div className="text-sm text-slate-600">
                <h3 className="block pb-4 text-lg font-semibold text-slate-800">Quick Tips</h3>
                <p className="font-bold">Authentication</p>
                <p className="my-3 text-sm text-slate-600">
                  Via the API you can send submissions directly to Formbricks HQ. The API doesn&apos;t need
                  any authentication and can also be called in the users browser.
                </p>
                <p className="pt-3 font-bold">customer</p>
                <p className="my-3 text-sm text-slate-600">
                  You can pass along a customer object to identify the respondent. This allows you to
                  attribute submissions of several surveys to the same respondent. This is optional.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="col-span-2">
          <div className="rounded-lg bg-slate-100 p-8">
            <label htmlFor="formId" className="block text-xl font-bold text-slate-800">
              Your Survey ID
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
              <h4 className="my-2 block text-xl font-semibold text-slate-800">Custom Survey Docs</h4>
              <p>Get detailed instructions in our Docs:</p>
              <Button
                variant="secondary"
                target="_blank"
                className="mt-2 w-full justify-center"
                href="https://formbricks.com/docs/best-practices/custom-survey">
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
  );
}
