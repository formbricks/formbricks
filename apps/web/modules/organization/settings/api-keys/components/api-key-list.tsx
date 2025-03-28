import { getApiKeysWithEnvironmentPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import { TOrganizationProject } from "@/modules/organization/settings/api-keys/types/api-keys";
import { TUserLocale } from "@formbricks/types/user";
import { EditAPIKeys } from "./edit-api-keys";

interface ApiKeyListProps {
  organizationId: string;
  locale: TUserLocale;
  isReadOnly: boolean;
  projects: TOrganizationProject[];
}

export const ApiKeyList = async ({ organizationId, locale, isReadOnly, projects }: ApiKeyListProps) => {
  const apiKeys = await getApiKeysWithEnvironmentPermissions(organizationId);

  return (
    <EditAPIKeys
      organizationId={organizationId}
      apiKeys={apiKeys}
      locale={locale}
      isReadOnly={isReadOnly}
      projects={projects}
    />
  );
};
