import EditTagsWrapper from "./EditTagsWrapper";
import SettingsTitle from "../SettingsTitle";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { getTagsByEnvironmentId } from "@formbricks/lib/services/tag";
import { getTagsCount } from "@formbricks/lib/services/tagOnResponse";

export default async function MembersSettingsPage({ params }) {
  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }
  const tags = await getTagsByEnvironmentId(params.environmentId);
  const environmentTagsCount = await getTagsCount();

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
