"use client";

import FeedbackResults from "@/components/forms/feedback/FeedbackResults";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";

export default function TeamFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <FeedbackResults />
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
