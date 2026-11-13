"use client";

import { useQuery } from "@tanstack/react-query";
import { organizationTeamsQueryOptions } from "../lib/teams-query";

/** The organization's teams, fetched only while the create-workspace dialog is open. */
export const useOrganizationTeams = (organizationId: string, { enabled }: { enabled: boolean }) =>
  useQuery({ ...organizationTeamsQueryOptions(organizationId), enabled });
