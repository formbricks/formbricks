export const revalidate = REVALIDATION_INTERVAL;

import ActivitySection from "@/app/(app)/environments/[environmentId]/people/[personId]/(activitySection)/ActivitySection";
import AttributesSection from "@/app/(app)/environments/[environmentId]/people/[personId]/(attributeSection)/AttributesSection";
import ResponseSection from "@/app/(app)/environments/[environmentId]/people/[personId]/(responseSection)/ResponseSection";
import HeadingSection from "@/app/(app)/environments/[environmentId]/people/[personId]/HeadingSection";
import { REVALIDATION_INTERVAL } from "@formbricks/lib/constants";
import { getEnvironment } from "@formbricks/lib/environment/service";

export default async function PersonPage({ params }) {
  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }
  return (
    <div>
      <main className="mx-auto px-4 sm:px-6 lg:px-8">
        <>
          <HeadingSection environmentId={params.environmentId} personId={params.personId} />
          <section className="pb-24 pt-6">
            <div className="grid grid-cols-1 gap-x-8  md:grid-cols-4">
              <AttributesSection personId={params.personId} />
              <ResponseSection environment={environment} personId={params.personId} />
              <ActivitySection environmentId={params.environmentId} personId={params.personId} />
            </div>
          </section>
        </>
      </main>
    </div>
  );
}
