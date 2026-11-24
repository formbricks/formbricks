/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

// The module keeps the document's nonce, so each test loads a fresh copy.
const load = async () => {
  vi.resetModules();
  const clientNonce = await import("./client-nonce");
  const { getNonce: getStyleSingletonNonce } = await import("get-nonce");
  return { ...clientNonce, getStyleSingletonNonce };
};

beforeEach(() => {
  delete window.__nonce__;
});

describe("resolveDocumentNonce", () => {
  test("gives script loaders and style-injecting libraries the page's nonce", async () => {
    const { resolveDocumentNonce, getClientCspNonce, getStyleSingletonNonce } = await load();

    expect(resolveDocumentNonce("page-nonce")).toBe("page-nonce");

    expect(getClientCspNonce()).toBe("page-nonce");
    expect(window.__nonce__).toBe("page-nonce");
    expect(getStyleSingletonNonce()).toBe("page-nonce");
  });

  test("keeps the document's nonce when a refresh re-renders the layout with a new request's", async () => {
    const { resolveDocumentNonce, getClientCspNonce } = await load();

    resolveDocumentNonce("document-nonce");

    expect(resolveDocumentNonce("refresh-nonce")).toBe("document-nonce");
    expect(getClientCspNonce()).toBe("document-nonce");
    expect(window.__nonce__).toBe("document-nonce");
  });

  test("leaves everything unset on a page served without a nonce", async () => {
    const { resolveDocumentNonce, getClientCspNonce } = await load();

    expect(resolveDocumentNonce(undefined)).toBeUndefined();

    expect(getClientCspNonce()).toBeUndefined();
    expect(window.__nonce__).toBeUndefined();
  });
});
