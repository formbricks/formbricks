/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useMcpGrantEdit } from "./use-mcp-grant-edit";

const OPENED_AT = "2026-06-01T10:00:00.123Z";
const REFETCHED_AT = "2026-06-01T10:05:00.000Z";

const client = (grantUpdatedAt: string) => ({
  clientId: "client/a",
  permissions: { surveys: "read" } as const,
  access: { access: "all" } as const,
  cap: { surveys: "write" } as const,
  grantUpdatedAt,
});

describe("useMcpGrantEdit", () => {
  // R4: the list refetches while Edit is open. Save must send the version the dialog opened, or a draft
  // made against it would pass the 409 check over a change saved elsewhere since.
  test("saves with the grant version it opened, not the one a refetch brought in", () => {
    const { result, rerender } = renderHook(({ current }) => useMcpGrantEdit(current), {
      initialProps: { current: client(OPENED_AT) },
    });

    act(() => result.current.draft.setPermissions({ surveys: "write" }));
    rerender({ current: client(REFETCHED_AT) });

    expect(result.current.saveRequest()).toEqual({
      clientId: "client/a",
      grant: { permissions: { surveys: "write" }, access: { access: "all" } },
      expectedUpdatedAt: OPENED_AT,
    });
  });

  test("has nothing to save while the selection picks nothing", () => {
    const { result } = renderHook(() => useMcpGrantEdit(client(OPENED_AT)));

    act(() =>
      result.current.draft.setAccess({ access: "workspaces", organizationIds: [], workspaceIds: [] })
    );

    expect(result.current.saveRequest()).toBeNull();
  });
});
