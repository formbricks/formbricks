import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { TUserLocale } from "@formbricks/types/user";
import { listApiKeysForOrganization } from "@/app/api/internal/api-keys/lib/operations";
import { ApiQueryClientProvider } from "@/modules/api/components/api-query-client-provider";
import { makeQueryClient } from "@/modules/api/lib/query-client";
import { apiKeyKeys } from "@/modules/organization/settings/api-keys/lib/query";
import { TOrganizationWorkspace } from "@/modules/organization/settings/api-keys/types/api-keys";
import { EditAPIKeys } from "./edit-api-keys";

interface ApiKeyListProps {
  organizationId: string;
  locale: TUserLocale;
  workspaces: TOrganizationWorkspace[];
  isFormbricksCloud: boolean;
  canGrantOrganizationWriteAccess: boolean;
}

/**
 * Renders the key table with its data already in the query cache: the keys are read here, on the server,
 * through the same function the API route answers with, and handed to the client cache. The first paint is
 * the full table; the client reads and writes through `/api/internal/api-keys` from then on.
 *
 * Only rendered after the page has checked `organization.manage_api_keys`.
 */
export const ApiKeyList = async ({
  organizationId,
  locale,
  workspaces,
  isFormbricksCloud,
  canGrantOrganizationWriteAccess,
}: Readonly<ApiKeyListProps>) => {
  const queryClient = makeQueryClient();
  queryClient.setQueryData(apiKeyKeys.list(organizationId), await listApiKeysForOrganization(organizationId));

  return (
    <ApiQueryClientProvider>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <EditAPIKeys
          organizationId={organizationId}
          locale={locale}
          workspaces={workspaces}
          isFormbricksCloud={isFormbricksCloud}
          canGrantOrganizationWriteAccess={canGrantOrganizationWriteAccess}
        />
      </HydrationBoundary>
    </ApiQueryClientProvider>
  );
};
