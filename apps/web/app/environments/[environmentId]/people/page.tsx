export const revalidate = 0;

import { Suspense } from "react";
import PeopleList from "@/app/environments/[environmentId]/people/PeopleList";
import Loading from "@/app/environments/[environmentId]/people/Loading";

export default function PeoplePage({ params }) {
  return (
    <Suspense fallback={<Loading />}>
      {/* @ts-expect-error Server Component */}
      <PeopleList environmentId={params.environmentId} />
    </Suspense>
  );
}
