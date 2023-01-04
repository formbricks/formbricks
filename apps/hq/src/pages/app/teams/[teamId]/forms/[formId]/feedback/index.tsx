"use client";

import FeedbackPage from "@/components/forms/feedback/FeedbackPage";
import LayoutApp from "@/components/layout/LayoutApp";
import LayoutWrapperTeam from "@/components/layout/LayoutWrapperTeam";

export default function TeamFormsPage({}) {
  return (
    <LayoutApp>
      <LayoutWrapperTeam>
        <FeedbackPage />
      </LayoutWrapperTeam>
    </LayoutApp>
  );
}
