/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// The client keeps module state (the document's nonce), so each test loads a fresh copy.
const load = async () => {
  vi.resetModules();
  const nonceModule = await import("./nonce");
  const getNonce = await import("get-nonce");
  return { ...nonceModule, getStyleSingletonNonce: getNonce.getNonce };
};

beforeEach(() => {
  delete window.__nonce__;
});

describe("CspNonceProvider", () => {
  test("gives components, script loaders and style-injecting libraries the page's nonce", async () => {
    const { CspNonceProvider, useCspNonce, getClientCspNonce, getStyleSingletonNonce } = await load();
    const Reader = () => <span>{useCspNonce()}</span>;

    render(
      <CspNonceProvider nonce="page-nonce">
        <Reader />
      </CspNonceProvider>
    );

    expect(screen.getByText("page-nonce")).toBeTruthy();
    expect(getClientCspNonce()).toBe("page-nonce");
    expect(window.__nonce__).toBe("page-nonce");
    expect(getStyleSingletonNonce()).toBe("page-nonce");
  });

  test("keeps the document's nonce when a refresh re-renders the layout with a new request's", async () => {
    const { CspNonceProvider, useCspNonce, getClientCspNonce } = await load();
    const Reader = () => <span data-testid="nonce">{useCspNonce()}</span>;

    const { rerender } = render(
      <CspNonceProvider nonce="document-nonce">
        <Reader />
      </CspNonceProvider>
    );
    rerender(
      <CspNonceProvider nonce="refresh-nonce">
        <Reader />
      </CspNonceProvider>
    );

    expect(screen.getByTestId("nonce").textContent).toBe("document-nonce");
    expect(getClientCspNonce()).toBe("document-nonce");
    expect(window.__nonce__).toBe("document-nonce");
  });

  test("leaves everything unset on a page served without a nonce", async () => {
    const { CspNonceProvider, getClientCspNonce } = await load();

    render(<CspNonceProvider nonce={undefined}>{null}</CspNonceProvider>);

    expect(getClientCspNonce()).toBeUndefined();
    expect(window.__nonce__).toBeUndefined();
  });
});
