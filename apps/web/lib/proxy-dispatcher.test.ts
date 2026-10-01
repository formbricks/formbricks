import { beforeEach, describe, expect, test, vi } from "vitest";

const { envMock, proxyAgentMock } = vi.hoisted(() => ({
  envMock: { HTTPS_PROXY: undefined as string | undefined, HTTP_PROXY: undefined as string | undefined },
  proxyAgentMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("undici", () => ({ ProxyAgent: proxyAgentMock }));

const load = async () => {
  vi.resetModules();
  return (await import("./proxy-dispatcher")).proxyDispatcher;
};

describe("proxyDispatcher", () => {
  beforeEach(() => {
    proxyAgentMock.mockReset();
    envMock.HTTPS_PROXY = undefined;
    envMock.HTTP_PROXY = undefined;
  });

  test("is undefined when no proxy is configured, so fetch connects directly", async () => {
    expect(await load()).toBeUndefined();
    expect(proxyAgentMock).not.toHaveBeenCalled();
  });

  test("builds one ProxyAgent from HTTPS_PROXY", async () => {
    envMock.HTTPS_PROXY = "http://proxy.internal:3128";
    await load();
    expect(proxyAgentMock).toHaveBeenCalledTimes(1);
    expect(proxyAgentMock).toHaveBeenCalledWith("http://proxy.internal:3128");
  });

  test("falls back to HTTP_PROXY, and HTTPS_PROXY wins when both are set", async () => {
    envMock.HTTP_PROXY = "http://http-only.internal:8080";
    await load();
    expect(proxyAgentMock).toHaveBeenLastCalledWith("http://http-only.internal:8080");

    envMock.HTTPS_PROXY = "http://https-proxy.internal:3128";
    await load();
    expect(proxyAgentMock).toHaveBeenLastCalledWith("http://https-proxy.internal:3128");
  });
});
