import GoogleTagRowData from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/GoogleTagRowData";
import GoogleTagTableHeading from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/GoogleTagTableHeading";
import GoogleTagsTable from "@/app/(app)/environments/[environmentId]/integrations/tag-manager/components/GoogleTagsTable";

import { getEnvironment } from "@formbricks/lib/environment/service";
import { getGoogleTags } from "@formbricks/lib/googleTag/service";
import { getSurveys } from "@formbricks/lib/survey/service";
import GoBackButton from "@formbricks/ui/GoBackButton";

export default async function CustomGoogleTagPage({ params }) {
  const [googleTagUnsorted, surveys, environment] = await Promise.all([
    getGoogleTags(params.environmentId),
    getSurveys(params.environmentId, 200), // HOTFIX: not getting all surveys for now since it's maxing out the prisma accelerate limit
    getEnvironment(params.environmentId),
  ]);
  if (!environment) {
    throw new Error("Environment not found");
  }
  const tags = googleTagUnsorted.sort((a, b) => {
    if (a.createdAt > b.createdAt) return -1;
    if (a.createdAt < b.createdAt) return 1;
    return 0;
  });
  return (
    <>
      <GoBackButton />
      <GoogleTagsTable environment={environment} googleTags={tags} surveys={surveys}>
        <GoogleTagTableHeading />
        {tags.map((tag) => (
          <GoogleTagRowData key={tag.id} googleTag={tag} surveys={surveys} />
        ))}
      </GoogleTagsTable>
    </>
  );
}
