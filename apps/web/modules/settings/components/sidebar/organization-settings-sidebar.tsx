"use client";

import {
  OrganizationAndAccountSections,
  type OrganizationAndAccountSectionsProps,
} from "@/modules/settings/components/sidebar/organization-and-account-sections";

// The settings sidebar for the workspace-agnostic routes (/organizations/[organizationId]/settings/**
// and /account/settings/**). Those routes carry no workspaceId — switching workspaces there is the top
// bar breadcrumb's job — so this sidebar has no concept of a workspace at all.
export const OrganizationSettingsSidebar = (props: Readonly<OrganizationAndAccountSectionsProps>) => (
  <div className="flex flex-col overflow-y-auto">
    <OrganizationAndAccountSections {...props} />
  </div>
);
