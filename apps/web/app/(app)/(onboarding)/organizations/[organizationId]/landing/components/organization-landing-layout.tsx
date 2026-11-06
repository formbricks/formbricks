import type { TOrganizationRole } from "@formbricks/types/memberships";
import type { TOrganization } from "@formbricks/types/organizations";
import type { TUser } from "@formbricks/types/user";
import { LandingSidebar } from "@/app/(app)/(onboarding)/organizations/[organizationId]/landing/components/landing-sidebar";
import { OrganizationBreadcrumb } from "@/app/(app)/workspaces/[workspaceId]/components/organization-breadcrumb";
import { IS_FORMBRICKS_SURVEYS_CONFIGURED } from "@/lib/constants";
import { Breadcrumb, BreadcrumbList } from "@/modules/ui/components/breadcrumb";

/**
 * The page of an organization that has no workspace to show: the onboarding landing page (no workspace
 * yet) and a Dashboard viewer's unavailable page (no granted workspace, or a lapsed plan). The sidebar
 * and the organization switcher are the same on both; only the body differs. Only the organization's id
 * and name reach the browser.
 */
export const OrganizationLandingLayout = ({
  user,
  organization,
  isMultiOrgEnabled,
  membershipRole,
  children,
}: Readonly<{
  user: TUser;
  organization: Pick<TOrganization, "id" | "name">;
  isMultiOrgEnabled: boolean;
  membershipRole?: TOrganizationRole;
  children: React.ReactNode;
}>) => {
  const { id, name } = organization;

  return (
    <div className="flex min-h-full min-w-full flex-row">
      <LandingSidebar
        user={user}
        organization={{ id, name }}
        isFormbricksSurveysConfigured={IS_FORMBRICKS_SURVEYS_CONFIGURED}
      />
      <div className="flex-1">
        <div className="flex h-full flex-col">
          <div className="p-6">
            {/* Organizations are lazy-loaded when the switcher opens. */}
            <Breadcrumb>
              <BreadcrumbList className="gap-0">
                <OrganizationBreadcrumb
                  currentOrganizationId={id}
                  currentOrganizationName={name}
                  isMultiOrgEnabled={isMultiOrgEnabled}
                  isLastCrumb
                  membershipRole={membershipRole}
                />
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};
