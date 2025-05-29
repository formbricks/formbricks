import { alchemy, sepolia } from "@account-kit/infra";
import { AlchemyAccountsUIConfig, cookieStorage, createConfig } from "@account-kit/react";
import { QueryClient } from "@tanstack/react-query";

const uiConfig: AlchemyAccountsUIConfig = {
  illustrationStyle: "flat",
  auth: {
    sections: [
      [{ type: "email" }],
      [
        { type: "passkey" },
        { type: "social", authProviderId: "google", mode: "popup" },
        { type: "social", authProviderId: "facebook", mode: "popup" },
      ],
      // [
      //   {
      //     type: "external_wallets",
      //     walletConnect: { projectId: process.env.NEXT_PUBLIC_ALCHEMY_PROJECT_ID || ""},
      //   },
      // ],
    ],
    addPasskeyOnSignup: true,
    hideSignInText: true,
    header: <h3 className="text-lg font-semibold">Sign up / Sign in</h3>,
  },
};

// Alchemy config
export const alchemyConfig = (apiKey: string) =>
  createConfig(
    {
      transport: alchemy({ apiKey }),
      chain: sepolia,
      ssr: true,
      enablePopupOauth: true,
      storage: cookieStorage,
      sessionConfig: {
        expirationTimeMs: 24 * 60 * 60 * 1000,
      },

      // policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID || ""
      // sessionConfig: {
      //     expirationTimeMs: 1000 * 60 * 60, // 60 minutes (default is 15 min)
      // },
    },
    uiConfig
  );

export const queryClient = new QueryClient();
