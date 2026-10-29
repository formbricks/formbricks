import { describe, expect, test } from "vitest";
import { zCreativeResource } from "@formbricks/api-v3-schemas";
import type { TCreativeDestinationSurveyState } from "./display-status";
import {
  type TCreativeEditorForm,
  type TCreativeResource,
  buildCreativePatch,
  toCreativeEditorForm,
} from "./editor-form";
import { keepSaveFromGoingLive, toSurveyStates } from "./save-status";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const PAST = "2026-10-20T12:00:00.000Z";
const FUTURE = "2026-10-25T12:00:00.000Z";
const SURVEY_ID = "clsurvey0000000000000001";
const OTHER_SURVEY_ID = "clsurvey0000000000000002";

const active: TCreativeDestinationSurveyState = { status: "inProgress", archivedAt: null };
const paused: TCreativeDestinationSurveyState = { status: "paused", archivedAt: null };

// A published feedback button that opens a survey. Its own `displayStatus` is ignored: the rule derives
// where it stands now from the same facts as where the save takes it.
const published = (patch: Record<string, unknown> = {}): TCreativeResource =>
  zCreativeResource.parse({
    id: "clcreative00000000000001",
    workspaceId: "clworkspace0000000000001",
    name: "Site feedback",
    type: "feedbackButton",
    status: "inProgress",
    displayStatus: "active",
    displayStatusReason: null,
    createdAt: "2026-10-16T08:00:00.000Z",
    updatedAt: "2026-10-16T08:00:00.000Z",
    publishedAt: "2026-10-16T08:00:00.000Z",
    archivedAt: null,
    creator: null,
    defaultLanguage: "en-US",
    languages: [{ code: "en-US", default: true, enabled: true }],
    content: { label: { "en-US": "Feedback" }, icon: "messageSquare" },
    styling: {
      position: { desktop: { edge: "right", offset: 50 }, phone: null },
      theme: {
        customStyles: false,
        backgroundColor: null,
        textColor: null,
        borderColor: null,
        borderRadius: null,
        fontWeight: null,
        fontSize: { desktop: null, phone: null },
        paddingX: { desktop: null, phone: null },
        paddingY: { desktop: null, phone: null },
      },
    },
    destination: { type: "survey", surveyId: SURVEY_ID, surveyName: "Site survey", opensAs: "popup" },
    distribution: { showOn: "pageView", triggers: [], conditions: null, displayPercentage: null },
    schedule: { startAt: null, endAt: null },
    warnings: [],
    ...patch,
  });

/** Saves the form after `edit`, as the editor's Save builds it. */
const save = (
  resource: TCreativeResource,
  edit: (form: TCreativeEditorForm) => TCreativeEditorForm,
  surveys: Record<string, TCreativeDestinationSurveyState> = { [SURVEY_ID]: active }
) =>
  keepSaveFromGoingLive(
    resource,
    buildCreativePatch(edit(toCreativeEditorForm(resource)), resource, "save"),
    {
      surveys: new Map(Object.entries(surveys)),
      now: NOW,
    }
  );

const toLink = (form: TCreativeEditorForm): TCreativeEditorForm => ({
  ...form,
  destination: { type: "link", url: "https://example.com/feedback" },
});

const relabel = (form: TCreativeEditorForm): TCreativeEditorForm => ({
  ...form,
  content: { type: "feedbackButton", label: "Tell us", icon: null },
});

const withSchedule =
  (startAt: string | null, endAt: string | null) =>
  (form: TCreativeEditorForm): TCreativeEditorForm => ({
    ...form,
    schedule: { startAt: startAt ? new Date(startAt) : null, endAt: endAt ? new Date(endAt) : null },
  });

describe("keepSaveFromGoingLive", () => {
  test("keeps a creative Paused with its survey paused when the save switches it to a link", () => {
    const result = save(published(), toLink, { [SURVEY_ID]: paused });

    expect(result.keptPaused).toBe(true);
    expect(result.body.status).toBe("paused");
    expect(result.body.destination).toEqual({ type: "link", url: "https://example.com/feedback" });
  });

  test("keeps it paused when the save switches it to another survey that is active", () => {
    const result = save(
      published(),
      (form) => ({ ...form, destination: { type: "survey", surveyId: OTHER_SURVEY_ID } }),
      { [SURVEY_ID]: paused, [OTHER_SURVEY_ID]: active }
    );

    expect(result.keptPaused).toBe(true);
    expect(result.body.status).toBe("paused");
  });

  test("counts an archived survey as not active, whatever its status", () => {
    const result = save(published(), toLink, {
      [SURVEY_ID]: { status: "inProgress", archivedAt: new Date(PAST) },
    });

    expect(result.keptPaused).toBe(true);
  });

  test("keeps it paused when the save gives it the Destination it was missing", () => {
    const result = save(published({ destination: null }), toLink);

    expect(result.keptPaused).toBe(true);
    expect(result.body.status).toBe("paused");
  });

  test("keeps it paused when the save gives it the action it was missing", () => {
    const result = save(
      published({
        distribution: { showOn: "action", triggers: [], conditions: null, displayPercentage: null },
      }),
      (form) => ({
        ...form,
        distribution: { ...form.distribution, actionClassIds: ["clactionclass00000000001"] },
      })
    );

    expect(result.keptPaused).toBe(true);
  });

  test("keeps it paused when a schedule edit would show it right away", () => {
    expect(
      save(published({ schedule: { startAt: FUTURE, endAt: null } }), withSchedule(null, null)).keptPaused
    ).toBe(true);
    expect(
      save(published({ schedule: { startAt: null, endAt: PAST } }), withSchedule(null, FUTURE)).keptPaused
    ).toBe(true);
  });

  test("leaves a schedule edit alone when it doesn't show it right away", () => {
    const result = save(
      published({ schedule: { startAt: FUTURE, endAt: null } }),
      withSchedule(FUTURE, null)
    );

    expect(result.keptPaused).toBe(false);
    expect(result.body.status).toBeUndefined();
  });

  test("leaves an Active creative's save alone", () => {
    const result = save(published(), relabel);

    expect(result.keptPaused).toBe(false);
    expect(result.body.status).toBeUndefined();
  });

  test("leaves a save alone that keeps it off the site anyway", () => {
    expect(save(published(), relabel, { [SURVEY_ID]: paused }).keptPaused).toBe(false);
    expect(save(published({ status: "paused" }), toLink, { [SURVEY_ID]: paused }).keptPaused).toBe(false);
    expect(save(published({ status: "completed" }), toLink, { [SURVEY_ID]: paused }).keptPaused).toBe(false);
    expect(
      save(published({ status: "draft", publishedAt: null }), toLink, { [SURVEY_ID]: paused }).keptPaused
    ).toBe(false);
  });

  test("doesn't hold back a creative whose start passed while the editor was open", () => {
    // Loaded as Scheduled; by the time of the save its start has passed, so it is live with or without it.
    const result = save(
      published({ displayStatus: "scheduled", schedule: { startAt: PAST, endAt: null } }),
      relabel
    );

    expect(result.keptPaused).toBe(false);
  });

  test("reads the picker's surveys, an archived one as not active", () => {
    const archivedAt = new Date(PAST);
    const surveys = toSurveyStates([
      { id: SURVEY_ID, status: "inProgress", archivedAt },
      { id: OTHER_SURVEY_ID, status: "inProgress" },
    ]);
    const result = keepSaveFromGoingLive(
      published(),
      buildCreativePatch(
        { ...toCreativeEditorForm(published()), destination: { type: "survey", surveyId: OTHER_SURVEY_ID } },
        published(),
        "save"
      ),
      { surveys, now: NOW }
    );

    expect(surveys.get(SURVEY_ID)).toEqual({ status: "inProgress", archivedAt });
    expect(surveys.get(OTHER_SURVEY_ID)).toEqual({ status: "inProgress", archivedAt: null });
    expect(result.keptPaused).toBe(true);
  });

  test("leaves a body that sets the status itself alone, such as Publish", () => {
    const resource = published({ status: "draft", publishedAt: null });
    const body = buildCreativePatch(toLink(toCreativeEditorForm(resource)), resource, "publish");
    const result = keepSaveFromGoingLive(resource, body, { surveys: new Map(), now: NOW });

    expect(result).toEqual({ body, keptPaused: false });
  });
});
