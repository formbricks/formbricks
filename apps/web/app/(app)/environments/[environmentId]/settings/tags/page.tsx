import EditTagsWrapper from "./EditTagsWrapper";
import SettingsTitle from "../SettingsTitle";
import { getEnvironment } from "@formbricks/lib/services/environment";
import { getTagsByEnvironmentId } from "@formbricks/lib/services/tag";

export default async function MembersSettingsPage({ params }) {
  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }
  const tags = await getTagsByEnvironmentId(params.environmentId);
  console.log("tags mere", tags);

  return (
    <div>
      <SettingsTitle title="Tags" />
      <EditTagsWrapper environment={environment} environmentTags={tags} />
    </div>
  );
}
