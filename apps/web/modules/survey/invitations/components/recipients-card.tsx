"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { MailsIcon, SendIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { TSegment } from "@formbricks/types/segment";
import {
  type TReminderSchedule,
  type TSurvey,
  type TSurveyInvitationConfig,
  ZSurveyInvitationConfig,
} from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { getInvitationSummaryAction, sendInvitationsAction, sendRemindersAction } from "../actions";
import {
  DEFAULT_INVITATION_BODY,
  DEFAULT_INVITATION_SUBJECT,
  DEFAULT_REMINDER_BODY,
  DEFAULT_REMINDER_SUBJECT,
  MERGE_FIELDS,
  type TInvitationSummary,
} from "../types/invitation";

// Loose draft type for the editor state. The canonical `TSurveyInvitationConfig`
// requires a valid cuid2 segmentId and other non-empty fields, which the form
// only has once the user fills it in. We validate on send rather than forcing
// the editor to hold only canonical values (which would require `null`
// placeholders that complicate every render).
type TManualRecipient = { email: string; firstName?: string; lastName?: string };

type TInvitationAudienceDraft =
  | { source: "segment"; segmentId: string }
  | { source: "snowflake"; queryId: string; emailColumn: string; nameColumn?: string }
  | { source: "manualList"; recipients: TManualRecipient[] };

interface TInvitationConfigDraft {
  audience: TInvitationAudienceDraft;
  reminderSchedule: TReminderSchedule;
  emailTemplates: TSurveyInvitationConfig["emailTemplates"];
}

interface RecipientsCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  segments: TSegment[];
}

const emptyDraft: TInvitationConfigDraft = {
  audience: { source: "segment", segmentId: "" },
  reminderSchedule: { enabled: false, daysAfterInvite: [3, 7], maxReminders: 2 },
  emailTemplates: {
    invitation: { subject: DEFAULT_INVITATION_SUBJECT, body: DEFAULT_INVITATION_BODY },
    reminder: { subject: DEFAULT_REMINDER_SUBJECT, body: DEFAULT_REMINDER_BODY },
  },
};

export const RecipientsCard = ({ localSurvey, setLocalSurvey, segments }: RecipientsCardProps) => {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<TInvitationSummary | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isReminding, setIsReminding] = useState(false);

  // Draft state lives separately from the survey object. We only mirror a
  // *validated* config into `localSurvey.invitationConfig` (or null if the
  // draft is incomplete), so an in-progress edit can't cause an otherwise-valid
  // survey save to fail Zod on the whole survey.
  const [draft, setDraft] = useState<TInvitationConfigDraft>(() => {
    const existing = localSurvey.invitationConfig as TInvitationConfigDraft | null | undefined;
    return existing ?? emptyDraft;
  });

  // Raw textarea content for manualList. Kept separately so partial lines
  // (e.g. "it@") while the user is mid-typing aren't filtered out of view.
  // We re-parse to `recipients` on every change, but the textarea renders
  // from this raw string so every keystroke is preserved.
  const [manualListRaw, setManualListRaw] = useState<string>(() => {
    const existing = localSurvey.invitationConfig as TInvitationConfigDraft | null | undefined;
    if (existing?.audience.source !== "manualList") return "";
    return existing.audience.recipients
      .map((r) =>
        [r.email, r.firstName ?? "", r.lastName ?? ""].join(", ").replace(/(,\s*)+$/, "")
      )
      .join("\n");
  });

  useEffect(() => {
    if (!open) return;
    getInvitationSummaryAction({ surveyId: localSurvey.id })
      .then((res) => {
        if (res?.data) setSummary(res.data);
      })
      .catch(() => {
        /* first-run before save: no invitations yet — ignore */
      });
  }, [open, localSurvey.id]);

  const mirrorToSurvey = (nextDraft: TInvitationConfigDraft) => {
    const parsed = ZSurveyInvitationConfig.safeParse(nextDraft);
    setLocalSurvey({
      ...localSurvey,
      invitationConfig: parsed.success ? parsed.data : null,
    });
  };

  const updateConfig = (patch: Partial<TInvitationConfigDraft>) => {
    const next: TInvitationConfigDraft = { ...draft, ...patch };
    setDraft(next);
    mirrorToSurvey(next);
  };

  const updateAudience = (audience: TInvitationAudienceDraft) => updateConfig({ audience });
  const updateTemplates = (templates: TSurveyInvitationConfig["emailTemplates"]) =>
    updateConfig({ emailTemplates: templates });

  const config = draft;
  const audience = draft.audience;

  const audienceIsValid =
    (audience.source === "segment" && Boolean(audience.segmentId)) ||
    (audience.source === "snowflake" && Boolean(audience.queryId && audience.emailColumn)) ||
    (audience.source === "manualList" && audience.recipients.length > 0);

  // Build a canonical, validated config for server dispatch. Returns null (and
  // shows a toast) if the draft fails schema validation — this is a belt-and-
  // braces check on top of `audienceIsValid`.
  const toValidatedConfig = (): TSurveyInvitationConfig | null => {
    const parsed = ZSurveyInvitationConfig.safeParse(draft);
    if (parsed.success) return parsed.data;
    toast.error(`Invitation config is incomplete: ${parsed.error.issues[0]?.message ?? "invalid"}`);
    return null;
  };

  const sendNow = async () => {
    if (!audienceIsValid) {
      toast.error("Pick a segment or configure a Snowflake query first");
      return;
    }
    const validated = toValidatedConfig();
    if (!validated) return;

    setIsSending(true);
    const res = await sendInvitationsAction({ surveyId: localSurvey.id, config: validated });
    setIsSending(false);
    if (res?.data) {
      toast.success(`Sent ${res.data.sent}, skipped ${res.data.skipped}, failed ${res.data.failed}`);
      const next = await getInvitationSummaryAction({ surveyId: localSurvey.id });
      if (next?.data) setSummary(next.data);
    } else {
      toast.error(getFormattedErrorMessage(res) || "Failed to send invitations");
    }
  };

  const remindNow = async () => {
    const validated = toValidatedConfig();
    if (!validated) return;
    setIsReminding(true);
    const res = await sendRemindersAction({ surveyId: localSurvey.id, config: validated });
    setIsReminding(false);
    if (res?.data) {
      toast.success(`Reminded ${res.data.sent} (${res.data.failed} failed)`);
      const next = await getInvitationSummaryAction({ surveyId: localSurvey.id });
      if (next?.data) setSummary(next.data);
    } else {
      toast.error(getFormattedErrorMessage(res) || "Failed to send reminders");
    }
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pr-5 pl-2">
            <MailsIcon className="h-7 w-7 rounded-full border border-slate-300 bg-slate-100 p-1.5 text-slate-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Recipients & reminders</p>
            <p className="mt-1 text-sm text-slate-500">Invite a list of people and chase non-responders.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="flex flex-col">
        <hr className="py-1 text-slate-600" />
        <div className="space-y-6 p-4">
          {summary && (
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="Invited" value={summary.total} />
              <Stat label="Sent" value={summary.sent} />
              <Stat label="Responded" value={summary.responded} />
              <Stat label="Pending" value={summary.pending} />
            </div>
          )}

          <section className="space-y-2">
            <Label>Audience source</Label>
            <Select
              value={audience.source}
              onValueChange={(value: "segment" | "snowflake" | "manualList") => {
                if (value === "segment") {
                  updateAudience({ source: "segment", segmentId: "" });
                } else if (value === "snowflake") {
                  updateAudience({ source: "snowflake", queryId: "", emailColumn: "email" });
                } else {
                  updateAudience({ source: "manualList", recipients: [] });
                  setManualListRaw("");
                }
              }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manualList">Manual email list</SelectItem>
                <SelectItem value="segment">Formbricks segment</SelectItem>
                <SelectItem value="snowflake">Snowflake query</SelectItem>
              </SelectContent>
            </Select>

            {audience.source === "segment" && (
              <Select
                value={audience.segmentId || ""}
                onValueChange={(segmentId) => updateAudience({ source: "segment", segmentId })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a segment…" />
                </SelectTrigger>
                <SelectContent>
                  {segments.length === 0 ? (
                    <div className="p-2 text-sm text-slate-500">
                      No segments yet — create one under Contacts.
                    </div>
                  ) : (
                    segments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title || s.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {audience.source === "manualList" && (
              <div className="space-y-2">
                <Label htmlFor="manualEmails">Recipients (email, first name, last name)</Label>
                <textarea
                  id="manualEmails"
                  className="min-h-28 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-sm"
                  value={manualListRaw}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setManualListRaw(raw);
                    // Parse only the lines that look like valid emails.
                    // Partial/in-progress lines stay in the textarea via the
                    // raw-string state above, but they don't get stored as
                    // recipients until they parse cleanly.
                    const recipients: TManualRecipient[] = raw
                      .split(/\n/)
                      .map((line) => {
                        const parts = line.split(",").map((s) => s.trim());
                        const email = parts[0] ?? "";
                        const firstName = parts[1] || undefined;
                        const lastName = parts[2] || undefined;
                        return { email, firstName, lastName };
                      })
                      .filter((r) => /.+@.+\..+/.test(r.email));
                    updateAudience({ source: "manualList", recipients });
                  }}
                  placeholder={
                    "alice@example.com\nbob@example.com, Bob\ncarol@example.com, Carol, Smith"
                  }
                />
                <p className="text-xs text-slate-500">
                  One recipient per line. Format: <code>email, firstName, lastName</code> (first and
                  last names are optional). {audience.recipients.length} valid recipient
                  {audience.recipients.length === 1 ? "" : "s"}.
                </p>
              </div>
            )}

            {audience.source === "snowflake" && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  The query must accept <strong>no parameters</strong> — it should return all recipients in a
                  single call. Parameterized queries are not yet supported.
                </p>
                <div>
                  <Label htmlFor="queryId">Query ID</Label>
                  <Input
                    id="queryId"
                    value={audience.queryId}
                    onChange={(e) => updateAudience({ ...audience, queryId: e.target.value.trim() })}
                    placeholder="e.g. active-members"
                  />
                </div>
                <div>
                  <Label htmlFor="emailColumn">Email column</Label>
                  <Input
                    id="emailColumn"
                    value={audience.emailColumn}
                    onChange={(e) => updateAudience({ ...audience, emailColumn: e.target.value.trim() })}
                  />
                </div>
                <div>
                  <Label htmlFor="nameColumn">Name column (optional)</Label>
                  <Input
                    id="nameColumn"
                    value={audience.nameColumn ?? ""}
                    onChange={(e) =>
                      updateAudience({
                        ...audience,
                        nameColumn: e.target.value.trim() || undefined,
                      })
                    }
                  />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <Label>Invitation email</Label>
            <Input
              value={config.emailTemplates.invitation.subject}
              onChange={(e) =>
                updateTemplates({
                  ...config.emailTemplates,
                  invitation: { ...config.emailTemplates.invitation, subject: e.target.value },
                })
              }
              placeholder="Subject"
            />
            <textarea
              className="min-h-32 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
              value={config.emailTemplates.invitation.body}
              onChange={(e) =>
                updateTemplates({
                  ...config.emailTemplates,
                  invitation: { ...config.emailTemplates.invitation, body: e.target.value },
                })
              }
            />
            <MergeFieldHints />
          </section>

          <section className="space-y-2">
            <Label>Scheduled reminders</Label>
            <div className="flex items-center gap-2">
              <input
                id="reminderScheduleEnabled"
                type="checkbox"
                checked={config.reminderSchedule.enabled}
                onChange={(e) =>
                  updateConfig({
                    reminderSchedule: { ...config.reminderSchedule, enabled: e.target.checked },
                  })
                }
              />
              <label htmlFor="reminderScheduleEnabled" className="text-sm">
                Auto-send reminders on a schedule (requires cron)
              </label>
            </div>
            {config.reminderSchedule.enabled && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="daysAfter">Days after invite (comma-separated)</Label>
                  <Input
                    id="daysAfter"
                    value={config.reminderSchedule.daysAfterInvite.join(", ")}
                    onChange={(e) => {
                      const parsed = e.target.value
                        .split(",")
                        .map((s) => parseInt(s.trim(), 10))
                        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 365);
                      updateConfig({
                        reminderSchedule: {
                          ...config.reminderSchedule,
                          daysAfterInvite: parsed,
                        },
                      });
                    }}
                    placeholder="3, 7, 14"
                  />
                </div>
                <div>
                  <Label htmlFor="maxReminders">Max reminders per person</Label>
                  <Input
                    id="maxReminders"
                    type="number"
                    min={0}
                    max={20}
                    value={config.reminderSchedule.maxReminders}
                    onChange={(e) =>
                      updateConfig({
                        reminderSchedule: {
                          ...config.reminderSchedule,
                          maxReminders: Math.max(0, Math.min(20, parseInt(e.target.value, 10) || 0)),
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <Label>Reminder email (used by manual & scheduled reminders)</Label>
            <Input
              value={config.emailTemplates.reminder.subject}
              onChange={(e) =>
                updateTemplates({
                  ...config.emailTemplates,
                  reminder: { ...config.emailTemplates.reminder, subject: e.target.value },
                })
              }
              placeholder="Subject"
            />
            <textarea
              className="min-h-32 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
              value={config.emailTemplates.reminder.body}
              onChange={(e) =>
                updateTemplates({
                  ...config.emailTemplates,
                  reminder: { ...config.emailTemplates.reminder, body: e.target.value },
                })
              }
            />
          </section>

          <div className="flex flex-wrap gap-2">
            <Button disabled={!audienceIsValid || isSending} onClick={sendNow}>
              <SendIcon className="mr-2 h-4 w-4" />
              {isSending ? "Sending…" : "Send invitations"}
            </Button>
            <Button
              variant="secondary"
              disabled={isReminding || !summary || summary.pending === 0}
              onClick={remindNow}>
              {isReminding ? "Reminding…" : "Send reminders to non-responders"}
            </Button>
            <p className="self-center text-xs text-slate-500">
              Save the survey first so config changes are persisted before sending.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
    <div className="text-xl font-semibold text-slate-800">{value}</div>
    <div className="text-xs text-slate-500">{label}</div>
  </div>
);

const MergeFieldHints = () => (
  <p className="text-xs text-slate-500">
    Available merge fields:{" "}
    {MERGE_FIELDS.map((f, i) => (
      <span key={f}>
        {i > 0 ? ", " : ""}
        <code className="rounded bg-slate-100 px-1 py-0.5">{`{{${f}}}`}</code>
      </span>
    ))}
  </p>
);
