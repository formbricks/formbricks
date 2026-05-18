import "server-only";
import { feedbackRecordsGatewayAuthorizer } from "@/modules/hub/feedback-records-gateway";
import { TGatewayRequestAuthorizer } from "./request";

export const gatewayRequestAuthorizers: TGatewayRequestAuthorizer[] = [feedbackRecordsGatewayAuthorizer];
