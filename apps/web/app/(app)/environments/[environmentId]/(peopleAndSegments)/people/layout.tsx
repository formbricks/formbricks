import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";
import { Metadata } from "next";

import { SidebarLayout } from "@formbricks/ui/SidebarLayout";

export const metadata: Metadata = {
  title: "People",
};

export default async function PeopleLayout({ params, children }) {
  return (
    <SidebarLayout sidebar={<PeopleSegmentsNav activeId="people" environmentId={params.environmentId} />}>
      {children}
    </SidebarLayout>
  );
}
