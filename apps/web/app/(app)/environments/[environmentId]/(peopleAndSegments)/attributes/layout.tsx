import PeopleSegmentsNav from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/components/PeopleSegmentsNav";

import { SidebarLayout } from "@formbricks/ui/SidebarLayout";

export default function AttributeLayout({ params, children }) {
  return (
    <SidebarLayout sidebar={<PeopleSegmentsNav activeId="attributes" environmentId={params.environmentId} />}>
      {children}
    </SidebarLayout>
  );
}
