import ActivitySection from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/[personId]/components/ActivitySection";
import AttributesSection from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/[personId]/components/AttributesSection";
import HeadingSection from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/[personId]/components/HeadingSection";
import ResponseSection from "@/app/(app)/environments/[environmentId]/(peopleAndSegments)/people/[personId]/components/ResponseSection";

import { getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";

export default async function PersonPage({ params }) {
  const [environment, environmentTags, product, attributeClasses] = await Promise.all([
    getEnvironment(params.environmentId),
    getTagsByEnvironmentId(params.environmentId),
    getProductByEnvironmentId(params.environmentId),
    getAttributeClasses(params.environmentId),
  ]);

  if (!product) {
    throw new Error("Product not found");
  }
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
              <ResponseSection
                environment={environment}
                personId={params.personId}
                environmentTags={environmentTags}
                attributeClasses={attributeClasses}
              />
              <ActivitySection environmentId={params.environmentId} personId={params.personId} />
            </div>
          </section>
        </>
      </main>
    </div>
  );
}
