import { z } from "zod";

export const gatewayAuthServices = {
  feedbackRecords: {
    tokenPurpose: "feedback_records_gateway",
  },
} as const;

const gatewayAuthServiceKeys = Object.keys(gatewayAuthServices) as [
  keyof typeof gatewayAuthServices,
  ...(keyof typeof gatewayAuthServices)[],
];

export const ZGatewayAuthService = z.enum(gatewayAuthServiceKeys);

export type TGatewayAuthService = z.infer<typeof ZGatewayAuthService>;

export const getGatewayAuthServiceTokenPurpose = (service: TGatewayAuthService): string => {
  return gatewayAuthServices[service].tokenPurpose;
};
