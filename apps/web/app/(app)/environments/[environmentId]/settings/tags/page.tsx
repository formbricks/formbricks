import EditTagsWrapper from "./EditTagsWrapper";
import SettingsTitle from "../SettingsTitle";
import { getEnvironment } from "@formbricks/lib/services/environment";

export default async function MembersSettingsPage({ params }) {
  const environment = await getEnvironment(params.environmentId);
  if (!environment) {
    throw new Error("Environment not found");
  }
  return (
    <div>
      <SettingsTitle title="Tags" />
      <EditTagsWrapper environment={environment} />
    </div>
  );
}
