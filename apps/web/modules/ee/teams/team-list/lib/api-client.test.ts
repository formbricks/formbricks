import { afterEach, describe, expect, test, vi } from "vitest";
import { jsonResponse } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { createTeam, deleteTeam, getTeam, updateTeam } from "./api-client";

const ORG_ID = "clorg11111111111111111111";
const TEAM_ID = "clteam1111111111111111111";

const team = {
  id: TEAM_ID,
  name: "Team",
  organizationId: ORG_ID,
  members: [{ userId: "cluser1111111111111111111", name: "User", role: "admin" }],
  workspaces: [{ workspaceId: "clwork1111111111111111111", workspaceName: "Workspace", permission: "read" }],
};

const stubFetch = (response: Response) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("team API client", () => {
  test("creates a team by POSTing its name to the organization's teams", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: team }, 201));

    await expect(createTeam({ organizationId: ORG_ID, body: { name: "Team" } })).resolves.toEqual(team);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/internal/teams?organizationId=${ORG_ID}`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Team" }) })
    );
  });

  test("reads a team with the current user's role in it", async () => {
    const fetchMock = stubFetch(jsonResponse({ data: { ...team, currentUserRole: "contributor" } }));

    await expect(getTeam(TEAM_ID)).resolves.toEqual({ ...team, currentUserRole: "contributor" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/internal/teams/${TEAM_ID}`,
      expect.objectContaining({ method: "GET" })
    );
  });

  test("PATCHes the team's settings", async () => {
    const body = {
      name: "Renamed",
      members: [{ userId: "cluser1111111111111111111", role: "admin" as const }],
      workspaces: [{ workspaceId: "clwork1111111111111111111", permission: "read" as const }],
    };
    const fetchMock = stubFetch(jsonResponse({ data: { ...team, name: "Renamed" } }));

    await expect(updateTeam({ teamId: TEAM_ID, body })).resolves.toMatchObject({ name: "Renamed" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/internal/teams/${TEAM_ID}`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify(body) })
    );
  });

  test("DELETEs a team and resolves on the 204", async () => {
    const fetchMock = stubFetch(jsonResponse(null, 204));

    await expect(deleteTeam(TEAM_ID)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/internal/teams/${TEAM_ID}`,
      expect.objectContaining({ method: "DELETE" })
    );
  });

  test("throws the server's reason, which the modal shows as it is", async () => {
    stubFetch(jsonResponse({ status: 409, detail: "Team name already exists", code: "conflict" }, 409));

    const error = await createTeam({ organizationId: ORG_ID, body: { name: "Team" } }).catch((e) => e);
    expect(error).toBeInstanceOf(V3ApiError);
    expect(error).toMatchObject({ status: 409, detail: "Team name already exists" });
  });
});
