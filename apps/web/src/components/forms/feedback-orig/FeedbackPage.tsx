"use client";

import TabNavigation from "@/components/TabNavigation";
import { InformationCircleIcon, RectangleStackIcon, ShareIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/router";
import { useState } from "react";
import FeedbackResults from "./FeedbackResults";
import PipelinesOverview from "../pipelines/PipelinesOverview";
import SetupInstructions from "./SetupInstructions";
import { useForm } from "@/lib/forms";
import LoadingSpinner from "@/components/LoadingSpinner";

const tabs = [
  { name: "Results", icon: RectangleStackIcon },
  { name: "Data Pipelines", icon: ShareIcon },
  { name: "Setup Instructions", icon: InformationCircleIcon },
];

export default function FeedbackPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState("Results");
  const { form, isLoadingForm, isErrorForm } = useForm(
    router.query.formId?.toString(),
    router.query.workspaceId?.toString()
  );

  if (isLoadingForm) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (isErrorForm) {
    return <div>Error loading ressources. Maybe you don&lsquo;t have enough access rights</div>;
  }

  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200 pt-8">
          <h1 className="pb-6 text-4xl font-bold tracking-tight text-gray-900">{form.label}</h1>
          <TabNavigation tabs={tabs} currentTab={currentTab} setCurrentTab={setCurrentTab} />
        </div>
        {currentTab === "Results" ? (
          <FeedbackResults />
        ) : currentTab === "Data Pipelines" ? (
          <PipelinesOverview />
        ) : currentTab === "Setup Instructions" ? (
          <SetupInstructions />
        ) : null}
      </main>
    </div>
  );
}
