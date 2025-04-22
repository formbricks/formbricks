import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SSOOptions } from "./sso-options";

// Mock environment variables
vi.mock("@/lib/env", () => ({
  env: {
    IS_FORMBRICKS_CLOUD: "0",
  },
}));

// Mock the translation hook
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the individual SSO buttons
vi.mock("./google-button", () => ({
  GoogleButton: ({ lastUsed, source }: any) => (
    <div data-testid="google-button" data-last-used={lastUsed} data-source={source}>
      Google Button
    </div>
  ),
}));

vi.mock("./github-button", () => ({
  GithubButton: ({ lastUsed, source }: any) => (
    <div data-testid="github-button" data-last-used={lastUsed} data-source={source}>
      Github Button
    </div>
  ),
}));

vi.mock("./azure-button", () => ({
  AzureButton: ({ lastUsed, source }: any) => (
    <div data-testid="azure-button" data-last-used={lastUsed} data-source={source}>
      Azure Button
    </div>
  ),
}));

vi.mock("./open-id-button", () => ({
  OpenIdButton: ({ lastUsed, source, text }: any) => (
    <div data-testid="openid-button" data-last-used={lastUsed} data-source={source}>
      {text}
    </div>
  ),
}));

vi.mock("./saml-button", () => ({
  SamlButton: ({ lastUsed, source, samlTenant, samlProduct }: any) => (
    <div
      data-testid="saml-button"
      data-last-used={lastUsed}
      data-source={source}
      data-tenant={samlTenant}
      data-product={samlProduct}>
      Saml Button
    </div>
  ),
}));

describe("SSOOptions Component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    googleOAuthEnabled: true,
    githubOAuthEnabled: true,
    azureOAuthEnabled: true,
    oidcOAuthEnabled: true,
    oidcDisplayName: "OpenID",
    callbackUrl: "http://localhost:3000",
    samlSsoEnabled: true,
    samlTenant: "test-tenant",
    samlProduct: "test-product",
    source: "signin" as const,
  };

  test("renders all SSO options when all are enabled", () => {
    render(<SSOOptions {...defaultProps} />);

    expect(screen.getByTestId("google-button")).toBeInTheDocument();
    expect(screen.getByTestId("github-button")).toBeInTheDocument();
    expect(screen.getByTestId("azure-button")).toBeInTheDocument();
    expect(screen.getByTestId("openid-button")).toBeInTheDocument();
    expect(screen.getByTestId("saml-button")).toBeInTheDocument();
  });

  test("only renders enabled SSO options", () => {
    render(
      <SSOOptions
        {...defaultProps}
        googleOAuthEnabled={false}
        githubOAuthEnabled={false}
        azureOAuthEnabled={false}
      />
    );

    expect(screen.queryByTestId("google-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("github-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("azure-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("openid-button")).toBeInTheDocument();
    expect(screen.getByTestId("saml-button")).toBeInTheDocument();
  });

  test("passes correct props to OpenID button", () => {
    render(<SSOOptions {...defaultProps} />);
    const openIdButton = screen.getByTestId("openid-button");

    expect(openIdButton).toHaveAttribute("data-source", "signin");
    expect(openIdButton).toHaveTextContent("auth.continue_with_oidc");
  });

  test("passes correct props to SAML button", () => {
    render(<SSOOptions {...defaultProps} />);
    const samlButton = screen.getByTestId("saml-button");

    expect(samlButton).toHaveAttribute("data-source", "signin");
    expect(samlButton).toHaveAttribute("data-tenant", "test-tenant");
    expect(samlButton).toHaveAttribute("data-product", "test-product");
  });

  test("passes correct source prop to all buttons", () => {
    render(<SSOOptions {...defaultProps} source="signup" />);

    expect(screen.getByTestId("google-button")).toHaveAttribute("data-source", "signup");
    expect(screen.getByTestId("github-button")).toHaveAttribute("data-source", "signup");
    expect(screen.getByTestId("azure-button")).toHaveAttribute("data-source", "signup");
    expect(screen.getByTestId("openid-button")).toHaveAttribute("data-source", "signup");
    expect(screen.getByTestId("saml-button")).toHaveAttribute("data-source", "signup");
  });
});
