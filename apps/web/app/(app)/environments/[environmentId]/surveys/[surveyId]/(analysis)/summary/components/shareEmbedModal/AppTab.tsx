"use client";

import Link from "next/link";
import { useState } from "react";
import { OptionsSwitch } from "@formbricks/ui/components/OptionsSwitch";

export const AppTab = ({ environmentId }) => {
  const [selectedTab, setSelectedTab] = useState("webapp");

  return (
    <div className="flex h-full grow flex-col">
      <OptionsSwitch
        options={[
          { value: "webapp", label: "Web app" },
          { value: "mobile", label: "Mobile app" },
        ]}
        currentOption={selectedTab}
        handleOptionChange={(value) => setSelectedTab(value)}
      />

      <div className="mt-4">
        {selectedTab === "webapp" ? <WebAppTab environmentId={environmentId} /> : <MobileAppTab />}
      </div>
    </div>
  );
};

const MobileAppTab = () => {
  return (
    <div>
      <p className="text-lg font-semibold text-slate-800">How to embed a survey on your React Native app</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          Follow the{" "}
          <Link
            href="https://formbricks.com/docs/developer-docs/react-native-in-app-surveys"
            target="_blank"
            className="decoration-brand-dark font-medium underline underline-offset-2">
            setup instructions for React Native apps
          </Link>{" "}
          to connect your app with Formbricks
        </li>
      </ol>
      <div className="mt-2 text-sm italic text-slate-700">
        We&apos;re working on SDKs for Flutter, Swift and Kotlin.
      </div>
    </div>
  );
};

const WebAppTab = ({ environmentId }) => {
  return (
    <div>
      <p className="text-lg font-semibold text-slate-800">How to embed a survey on your web app</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          Follow these{" "}
          <Link
            href={`/environments/${environmentId}/product/app-connection`}
            target="_blank"
            className="decoration-brand-dark font-medium underline underline-offset-2">
            setup instructions
          </Link>{" "}
          to connect your web app with Formbricks
        </li>
        <li>
          Learn how to{" "}
          <Link
            href="https://formbricks.com/docs/app-surveys/user-identification"
            target="_blank"
            className="decoration-brand-dark font-medium underline underline-offset-2">
            identify users and set attributes
          </Link>{" "}
          to run highly targeted surveys.
        </li>
        <li>
          Make sure the survey type is set to <b>App survey</b>
        </li>
        <li>Define when and where the survey should pop up</li>
      </ol>
      <div className="mt-4">
        <video autoPlay loop muted className="w-full rounded-xl border border-slate-200">
          <source src="/video/tooltips/change-survey-type-app.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
};
