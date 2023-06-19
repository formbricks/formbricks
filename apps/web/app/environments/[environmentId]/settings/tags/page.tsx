import EditTagsWrapper from "@/app/environments/[environmentId]/settings/tags/EditTagsWrapper";
import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";

export default function MembersSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="Tags" />
      <SettingsCard title="Manage tags" description="Add or remove tags in your team.">
        <EditTagsWrapper environmentId={params.environmentId} />
      </SettingsCard>
    </div>
  );
}
