"use client";

import TabNavigation from "@/components/TabNavigation";
import { RectangleStackIcon, ShareIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/router";
import { useState } from "react";
import FeedbackResults from "./FeedbackResults";
import PipelinesOverview from "../pipelines/PipelinesOverview";

const subCategories = [
  { name: "All", href: "#" },
  { name: "Ideas", href: "#" },
  { name: "Love", href: "#" },
  { name: "Bugs", href: "#" },
];

const tabs = [
  { name: "Results", icon: RectangleStackIcon },
  { name: "Data Pipelines", icon: ShareIcon },
];

export default function FeedbackPage() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState("Results");

  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200 pt-8">
          <h1 className="pb-6 text-4xl font-bold tracking-tight text-gray-900">Feedback</h1>
          <TabNavigation tabs={tabs} currentTab={currentTab} setCurrentTab={setCurrentTab} />
        </div>
        {currentTab === "Results" ? (
          <FeedbackResults />
        ) : currentTab === "Data Pipelines" ? (
          <PipelinesOverview />
        ) : null}
      </main>
    </div>
  );
}
