import type { TFunction } from "i18next";
import { InvalidInputError, ValidationError } from "@formbricks/types/errors";

export type TBulkInviteFailureReason =
  | "invite_already_exists"
  | "user_already_member"
  | "duplicate_team_ids"
  | "invalid_team_ids"
  | "unknown";

export type TBulkInviteResult = {
  email: string;
  success: boolean;
  failureReason?: TBulkInviteFailureReason;
};

const INVITE_ALREADY_EXISTS_MESSAGE = "Invite already exists";
const USER_ALREADY_MEMBER_MESSAGE = "User is already a member of this organization";
const DUPLICATE_TEAM_IDS_MESSAGE = "teamIds must be unique";
const INVALID_TEAM_IDS_MESSAGE = "Invalid teamIds";

const MESSAGE_TO_REASON: Record<string, TBulkInviteFailureReason> = {
  [INVITE_ALREADY_EXISTS_MESSAGE]: "invite_already_exists",
  [USER_ALREADY_MEMBER_MESSAGE]: "user_already_member",
  [DUPLICATE_TEAM_IDS_MESSAGE]: "duplicate_team_ids",
  [INVALID_TEAM_IDS_MESSAGE]: "invalid_team_ids",
};

export const getInviteFailureReason = (error: unknown): TBulkInviteFailureReason => {
  if (error instanceof InvalidInputError || error instanceof ValidationError) {
    return MESSAGE_TO_REASON[error.message] ?? "unknown";
  }

  if (error instanceof Error) {
    return MESSAGE_TO_REASON[error.message] ?? "unknown";
  }

  return "unknown";
};

export const getInviteFailureReasonFromMessage = (message: string): TBulkInviteFailureReason =>
  MESSAGE_TO_REASON[message] ?? "unknown";

export const formatInviteFailureMessage = (
  t: TFunction,
  params: { email: string; failureReason: TBulkInviteFailureReason }
): string => {
  switch (params.failureReason) {
    case "invite_already_exists":
      return t("workspace.settings.general.invite_failure_invite_exists", { email: params.email });
    case "user_already_member":
      return t("workspace.settings.general.invite_failure_already_member", { email: params.email });
    case "duplicate_team_ids":
      return t("workspace.settings.general.invite_failure_duplicate_teams", { email: params.email });
    case "invalid_team_ids":
      return t("workspace.settings.general.invite_failure_invalid_teams", { email: params.email });
    case "unknown":
      return t("workspace.settings.general.invite_failure_unknown", { email: params.email });
  }
};

const MAX_FAILURE_LINES = 5;

export const formatInviteFailureMessages = (
  t: TFunction,
  failures: { email: string; failureReason: TBulkInviteFailureReason }[]
): string => {
  const lines = failures.slice(0, MAX_FAILURE_LINES).map((failure) => formatInviteFailureMessage(t, failure));

  if (failures.length > MAX_FAILURE_LINES) {
    lines.push(
      t("workspace.settings.general.invite_failures_more", {
        count: failures.length - MAX_FAILURE_LINES,
      })
    );
  }

  return lines.join("\n");
};
