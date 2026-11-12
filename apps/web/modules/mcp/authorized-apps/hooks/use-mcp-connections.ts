"use client";

import { useQuery } from "@tanstack/react-query";
import { getMcpConnections } from "../lib/api-client";
import { mcpConnectionKeys } from "../lib/query";

/** The session user's MCP connections with their grants, as Authorized apps lists them. */
export const useMcpConnections = () =>
  useQuery({
    queryKey: mcpConnectionKeys.list(),
    queryFn: ({ signal }) => getMcpConnections(signal),
  });
