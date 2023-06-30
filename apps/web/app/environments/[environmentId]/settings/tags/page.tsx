import EditTagsWrapper from "./EditTagsWrapper";
import SettingsTitle from "../SettingsTitle";

export default function MembersSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="Tags" />
      <EditTagsWrapper environmentId={params.environmentId} />
    </div>
  );
}
