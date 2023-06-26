import DocsSidebar from "../DocsSidebar";
import IntegrationPageTitle from "../IntegrationsPageTitle";
import CodeBlock from "@/components/shared/CodeBlock";
import JsLogo from "@/images/jslogo.png";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import Image from "next/image";
import Link from "next/link";

export default function JsIntegrationPage({ params }) {
  return (
    <div>
      <IntegrationPageTitle
        environmentId={params.environmentId}
        title="Javascript Integration"
        icon={<Image src={JsLogo} alt="Javascript Logo" />}
      />

      <div className="flex justify-between gap-8">
        <div>
          <p className="mb-10 text-slate-800">
            The Formbricks Javascript Widget is the easiest way to integrate Formbricks into your web
            application. Once embedded, the SDK allows you to use all the Formbricks features like no code
            actions, show in-app surveys and synchronizing your user data with Formbricks.
          </p>
          <div className="prose prose-slate">
            <p className="text-lg font-semibold text-slate-800">Step 1: NPM Install</p>
            <CodeBlock language="sh">npm install @formbricks/js --save</CodeBlock>
            <p className="pt-4 text-lg font-semibold text-slate-800">Step 2: Initialize widget</p>
            <p>Import Formbricks and initialize the widget in your Component (e.g. App.tsx):</p>
            <CodeBlock language="js">{`import formbricks from "@formbricks/js";

if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: "${params.environmentId}",
    apiHost: "${WEBAPP_URL}",
    logLevel: "debug", // remove when in production
  });
}`}</CodeBlock>

            <ul className="list-disc">
              <li>
                <span className="font-semibold">environmentId:</span> Used to identify the correct
                environment: {params.environmentId} is yours.
              </li>
              <li>
                <span className="font-semibold">apiHost:</span> This is the URL of your Formbricks backend.
              </li>
            </ul>
            <p className="text-lg font-semibold text-slate-800">You&apos;re done 🎉</p>
            <p>
              Your app now communicates with Formbricks - sending events, and loading surveys automatically!
            </p>

            <ul className="list-disc text-slate-700">
              <li>
                <span className="font-semibold">Does your widget work? </span>
                <span>Scroll to the top!</span>
              </li>
              <li>
                <span className="font-semibold">
                  Need a more detailed setup guide for React, Next.js or Vue.js?
                </span>{" "}
                <Link
                  className="decoration-brand-dark"
                  href="https://formbricks.com/docs/getting-started/quickstart"
                  target="_blank">
                  Check out the docs.
                </Link>
              </li>
              <li>
                <span className="font-semibold">Have a problem?</span>{" "}
                <Link
                  className="decoration-brand-dark"
                  target="_blank"
                  href="https://github.com/formbricks/formbricks/issues">
                  Open an issue on GitHub
                </Link>{" "}
                or{" "}
                <Link className="decoration-brand-dark" href="https://formbricks.com/discord" target="_blank">
                  join Discord.
                </Link>
              </li>
              <li>
                <span className="font-semibold">
                  Want to learn how to add user attributes, custom events and more?
                </span>{" "}
                <Link
                  className="decoration-brand-dark"
                  href="https://formbricks.com/docs/attributes/why"
                  target="_blank">
                  Dive into the docs.
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div>
          <DocsSidebar />
        </div>
      </div>
    </div>
  );
}
