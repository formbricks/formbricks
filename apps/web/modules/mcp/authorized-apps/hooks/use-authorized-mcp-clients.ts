"use client";

import { useQuery } from "@tanstack/react-query";
import { getAuthorizedMcpClients } from "../lib/api-client";
import { authorizedMcpClientKeys } from "../lib/query";

/** The session user's MCP clients with their grants, as Authorized apps lists them. */
export const useAuthorizedMcpClients = () =>
  useQuery({
    queryKey: authorizedMcpClientKeys.list(),
    queryFn: ({ signal }) => getAuthorizedMcpClients(signal),
  });
