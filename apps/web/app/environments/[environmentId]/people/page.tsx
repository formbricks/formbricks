export const revalidate = 0;

import { Suspense } from "react";
import PeopleList from "@/app/environments/[environmentId]/people/PeopleList";
import LoadingSpinnerInTable from "@/components/shared/LoadingSpinnerInTable";

export default function PeoplePage({ params }) {
  return (
    <Suspense fallback={<LoadingSpinnerInTable />}>
      {/* @ts-expect-error Server Component */}
      <PeopleList environmentId={params.environmentId} />
    </Suspense>
  );
}
