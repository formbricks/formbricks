import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createPinnedDispatcher } from "./validate-webhook-url";

// Real DNS, no node:dns mock. The whole point of this file is to prove that
// the pinned dispatcher bypasses DNS entirely — so the hostname we use must
// genuinely fail to resolve in real life.
vi.unmock("node:dns");

vi.mock("../constants", () => ({
  DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS: false,
}));

describe("DNS rebinding TOCTOU — pinned dispatcher", () => {
  let server: http.Server;
  let port: number;
  const visited: string[] = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      visited.push(req.headers.host ?? "");
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("hit-pinned-target");
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("baseline: fetch to *.invalid hostname fails (real DNS cannot resolve it)", async () => {
    // RFC 2606 reserves the .invalid TLD — guaranteed to never resolve.
    // This proves DNS is what fetch normally relies on.
    await expect(
      fetch(`http://attacker-rebind.invalid:${port}/`).catch((e: Error) => {
        throw new Error(e.message);
      })
    ).rejects.toThrow(/fetch failed/i);
  });

  test("with pinned dispatcher: connection lands on pinned IP even though hostname is unresolvable", async () => {
    // Simulates: validate resolved attacker.com to a public IP (here represented
    // by 127.0.0.1 — the local test server). Attacker then rebinds DNS so a
    // second lookup would return something different (or nothing). The pinned
    // dispatcher means there *is* no second lookup — undici uses our IP.
    const dispatcher = createPinnedDispatcher({ ip: "127.0.0.1", family: 4 });
    try {
      const response = await fetch(`http://attacker-rebind.invalid:${port}/`, {
        // RequestInit doesn't type `dispatcher` — undici accepts it at runtime.
        dispatcher,
      } as RequestInit & { dispatcher: typeof dispatcher });

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe("hit-pinned-target");
      // The Host header preserves the original hostname (TLS SNI parity);
      // only the TCP target was rerouted via the pin.
      expect(visited.at(-1)).toContain("attacker-rebind.invalid");
    } finally {
      await dispatcher.close();
    }
  });
});
