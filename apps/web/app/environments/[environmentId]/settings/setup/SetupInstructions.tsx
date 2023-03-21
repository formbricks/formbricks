"use client";

import TabBar from "@/components/ui/TabBar";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IoLogoHtml5, IoLogoReact } from "react-icons/io5";
import Prism from "prismjs";
import "prismjs/themes/prism.css";

const tabs = [
  { id: "react", label: "React", icon: <IoLogoReact /> },
  { id: "html", label: "HTML", icon: <IoLogoHtml5 /> },
];

export default function SetupInstructions({ environmentId }) {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  useEffect(() => {
    Prism.highlightAll();
  }, [activeTab]);

  return (
    <div>
      <TabBar tabs={tabs} activeId={activeTab} setActiveId={setActiveTab} />
      <div className="px-6 py-5">
        {activeTab === "react" ? (
          <div className="prose prose-slate">
            <p className="text-lg font-semibold text-slate-800">Step 1: NPM Install</p>
            <div className="mt-4 rounded-md font-light text-slate-200">
              <pre>
                <code className="language-js whitespace-pre-wrap">npm install @formbricks/js</code>
              </pre>
            </div>
            <p className="pt-4 text-lg font-semibold text-slate-800">Step 2: Initialize widget</p>
            <p>Import Formbricks and initialize the widget in your Component (e.g. App.tsx):</p>
            <div className="mt-4 rounded-md font-light text-slate-200">
              <pre>
                <code className="language-js whitespace-pre-wrap">
                  {`import formbricks from "@formbricks/js";

if (typeof window !== "undefined") {
  formbricks.init({
    environmentId: "${environmentId}",
    apiHost: "${window.location.protocol}//${window.location.host}",
  });
}`}
                </code>
              </pre>
            </div>
            <ul className="list-disc">
              <li>
                <span className="font-semibold">environmentId:</span> Used to identify the correct
                environment: {environmentId} is yours.
              </li>
              <li>
                <span className="font-semibold">apiHost:</span> localhost for tests in development
                environment. To use in production, replace with Formbricks backend URL.
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
                <Link className="decoration-brand-dark" href="https://formbricks.com/docs" target="_blank">
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
            <div className="mt-4 rounded-md font-light text-slate-200">
              <pre>
                <code className="language-js whitespace-pre-wrap">{`<script type="text/javascript">
!function(){var t=document.createElement("script");t.type="text/javascript",t.async=!0,t.src="./dist/index.umd.js";var e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(t,e),setTimeout(function(){window.formbricks.init("${environmentId}","${window.location.protocol}//${window.location.host}")},500)}();
</script>`}</code>
              </pre>
            </div>
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
                <Link className="decoration-brand-dark" href="https://formbricks.com/docs" target="_blank">
                  Dive into the docs.
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
