"use client";

import CodeBlock from "@/components/shared/CodeBlock";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { TabBar } from "@formbricks/ui";
import Link from "next/link";
import "prismjs/themes/prism.css";
import { useState } from "react";
import { IoLogoHtml5, IoLogoNpm } from "react-icons/io5";
import packageJson from "@/package.json";
import { WEBAPP_URL } from "@formbricks/lib/constants";

const tabs = [
  { id: "npm", label: "NPM", icon: <IoLogoNpm /> },
  { id: "html", label: "HTML", icon: <IoLogoHtml5 /> },
];

export default function SetupInstructions({ environmentId }) {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  return (
    <div>
      <TabBar tabs={tabs} activeId={activeTab} setActiveId={setActiveTab} />
      <div className="px-6 py-5">
        {activeTab === "npm" ? (
          <div className="prose prose-slate">
            <p className="text-lg font-semibold text-slate-800">Step 1: NPM Install</p>
            <CodeBlock language="sh">npm install @formbricks/js --save</CodeBlock>
            <p className="pt-4 text-lg font-semibold text-slate-800">Step 2: Initialize widget</p>
            <p>Import Formbricks and initialize the widget in your Component (e.g. App.tsx):</p>
            <CodeBlock language="js">{`import formbricks from "@formbricks/js";

if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: "${environmentId}",
    apiHost: "${WEBAPP_URL}",
    debug: true, // remove when in production 
  });
}`}</CodeBlock>

            <ul className="list-disc">
              <li>
                <span className="font-semibold">environmentId:</span> Used to identify the correct
                environment: {environmentId} is yours.
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
        ) : activeTab === "html" ? (
          <div className="prose prose-slate">
            <p className="text-lg font-semibold text-slate-800">Step 1: Copy and paste code</p>
            <p>
              Insert this code into the <code>{`<head>`}</code> tag of your website:
            </p>
            <CodeBlock language="js">{`<!-- START Formbricks Surveys -->
<script type="text/javascript">
!function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="https://unpkg.com/@formbricks/js@^1.0.0/dist/index.umd.js";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks=window.js;window.formbricks.init({environmentId: "${environmentId}", apiHost: "${window.location.protocol}//${window.location.host}"})},500)}();
</script>
<!-- END Formbricks Surveys -->`}</CodeBlock>
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
        ) : null}
        {!IS_FORMBRICKS_CLOUD && (
          <div>
            <hr className="my-3" />
            <p className="flex w-full justify-end text-sm text-slate-700">
              Formbricks version: {packageJson.version}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
