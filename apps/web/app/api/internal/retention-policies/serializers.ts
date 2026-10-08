import type {
  TRetentionPolicies,
  TRetentionPolicyKind,
  TRetentionPolicySettings,
} from "@/modules/ee/data-retention/types";

const withoutConditions = ({ conditions: _conditions, ...settings }: TRetentionPolicySettings) => settings;

/** The policies document (ENG-3695). Only the surveys policy has conditions. */
export const serializeRetentionPolicies = (
  settings: Record<TRetentionPolicyKind, TRetentionPolicySettings>
): TRetentionPolicies => ({
  responses: withoutConditions(settings.responses),
  surveys: settings.surveys,
  members: withoutConditions(settings.members),
});
