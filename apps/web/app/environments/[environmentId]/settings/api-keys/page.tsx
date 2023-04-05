import SettingsCard from "../SettingsCard";
import SettingsTitle from "../SettingsTitle";
import ApiKeyList from "./ApiKeyList";

export default async function ProfileSettingsPage({ params }) {
  return (
    <div>
      <SettingsTitle title="API Keys" />
      <SettingsCard
        title="Development Env Keys"
        description="Add and remove API keys for your Development environment.">
        <ApiKeyList environmentId={params.environmentId} environmentType="development" />
      </SettingsCard>
      <SettingsCard
        title="Production Env Keys"
        description="Add and remove API keys for your Production environment.">
        <ApiKeyList environmentId={params.environmentId} environmentType="production" />
      </SettingsCard>
    </div>
  );
}
