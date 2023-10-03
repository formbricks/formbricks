import EditTagsWrapper from "./EditTagsWrapper";
import SettingsTitle from "../SettingsTitle";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getTagsOnResponsesCount } from "@formbricks/lib/services/tagOnResponse";

export default async function MembersSettingsPage({ params }) {
  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }
  const tags = await getTagsByEnvironmentId(params.environmentId);
  const environmentTagsCount = await getTagsOnResponsesCount();

  return (
    <div>
      <SettingsTitle title="Tags" />
      <EditTagsWrapper
        environment={environment}
        environmentTags={tags}
        environmentTagsCount={environmentTagsCount}
      />
    </div>
  );
}
