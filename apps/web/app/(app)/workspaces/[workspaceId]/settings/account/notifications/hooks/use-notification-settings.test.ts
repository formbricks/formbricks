/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createQueryWrapper, jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { notificationSettingsKeys } from "../lib/query";
import { useNotificationSettings, useUpdateNotificationSetting } from "./use-notification-settings";

const URL = "/api/internal/users/me/notification-settings";
const settings = (alert: Record<string, boolean>, unsubscribedOrganizationIds: string[] = []) => ({
  alert,
  unsubscribedOrganizationIds,
});

const setup = (seed?: ReturnType<typeof settings>) => {
  const { queryClient, wrapper } = createQueryWrapper();
  if (seed) queryClient.setQueryData(notificationSettingsKeys.mine(), seed);
  return { queryClient, wrapper, cached: () => queryClient.getQueryData(notificationSettingsKeys.mine()) };
};

const sentBody = () => {
  const call = vi.mocked(global.fetch).mock.calls.find(([, init]) => init?.method === "PATCH");
  return JSON.parse(String(call?.[1]?.body));
};

describe("notification settings hooks", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads the signed-in user's switches", async () => {
    routeFetch({ [`GET ${URL}`]: [json({ data: settings({ s1: true }) })] });
    const { wrapper } = setup();

    const { result } = renderHook(() => useNotificationSettings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(settings({ s1: true }));
  });

  test("sends one survey alert toggle and stores every switch the server answers with", async () => {
    // The server's answer also carries a switch flipped elsewhere meanwhile (s2): it wins over the cache.
    routeFetch({ [`PATCH ${URL}`]: [json({ data: settings({ s1: false, s2: true }) })] });
    const { wrapper, cached } = setup(settings({ s1: true, s2: false }));
    const { result } = renderHook(() => useUpdateNotificationSetting(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ type: "alert", surveyId: "s1", enabled: false });
    });

    expect(sentBody()).toEqual({ type: "alert", surveyId: "s1", enabled: false });
    expect(cached()).toEqual(settings({ s1: false, s2: true }));
  });

  test("sends an organization subscription toggle", async () => {
    routeFetch({ [`PATCH ${URL}`]: [json({ data: settings({}, ["org1"]) })] });
    const { wrapper, cached } = setup(settings({}));
    const { result } = renderHook(() => useUpdateNotificationSetting(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        type: "organizationEmails",
        organizationId: "org1",
        subscribed: false,
      });
    });

    expect(sentBody()).toEqual({ type: "organizationEmails", organizationId: "org1", subscribed: false });
    expect(cached()).toEqual(settings({}, ["org1"]));
  });

  test("refetches the stored switches when the server refuses the change", async () => {
    routeFetch({
      [`PATCH ${URL}`]: [json({ status: 400, detail: "Bad request", code: "bad_request" }, 400)],
      [`GET ${URL}`]: [json({ data: settings({ s1: true, s2: true }) })],
    });
    const { wrapper, cached } = setup(settings({ s1: true }));
    const { result } = renderHook(
      () => ({ query: useNotificationSettings(), mutation: useUpdateNotificationSetting() }),
      { wrapper }
    );

    await act(async () => {
      await expect(
        result.current.mutation.mutateAsync({ type: "alert", surveyId: "s1", enabled: false })
      ).rejects.toMatchObject({ status: 400 });
    });

    await waitFor(() => expect(cached()).toEqual(settings({ s1: true, s2: true })));
  });
});
