import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { type UsersFixture } from "../fixtures/users";

/**
 * Self-seeding helper for app-survey widget specs.
 *
 * Provisions a workspace plus a published app survey wired to a code action, all
 * through Prisma — the same boundary the `users` fixture writes through — so a spec
 * does not have to drive the survey editor UI to get a survey on a host page. The
 * legacy `questions` shape is converted with the SAME `transformQuestionsToBlocks`
 * the v1 management API uses server-side rather than hand-crafting blocks JSON.
 *
 * Widget placement and overlay live on the Workspace, not the Survey (see
 * `packages/database/schema/main.prisma` `WidgetPlacement` / `SurveyOverlay`), so the
 * caller picks them here.
 */

// The transform's own (legacy v1) question input type, derived from its signature so
// this file does not reference the deprecated TSurveyQuestion name directly.
type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

// Named so the i18n scanner's t(...) pattern does not treat these fixture strings as
// translation keys (this file is scanned; *.spec.ts files are not).
const i18nValue = (value: string): { default: string } => ({ default: value });

export interface SeededAppSurvey {
  workspaceId: string;
  /** `key` of the code action that triggers the survey — pass to `formbricks.track()`. */
  actionKey: string;
}

export interface SeedAppSurveyOptions {
  overlay?: "none" | "light" | "dark";
  placement?: "bottomRight" | "bottomLeft" | "topRight" | "topLeft" | "center";
}

const buildQuestions = () =>
  [
    {
      id: "openText",
      type: "openText",
      headline: i18nValue("What would you like to know?"),
      required: false,
      inputType: "text",
      longAnswer: false,
      charLimit: { enabled: false },
      placeholder: i18nValue("Type your answer here..."),
    },
  ] as unknown as TLegacyQuestions;

const buildEndings = () =>
  [
    {
      id: createId(),
      type: "endScreen",
      headline: i18nValue("Thanks!"),
    },
  ] as unknown as TSurveyEnding[];

/**
 * Seeds a workspace user plus one published app survey triggered by a code action.
 * The survey re-displays on every trigger (`respondMultiple`, no cooldown) so a spec
 * can open it repeatedly without recontact rules getting in the way.
 */
export const seedAppSurvey = async (
  users: UsersFixture,
  options: SeedAppSurveyOptions = {}
): Promise<SeededAppSurvey> => {
  const { overlay = "none", placement = "bottomRight" } = options;

  const user = await users.create({ skipSurveySeed: true });
  const workspaceId = user.workspaceId;
  if (!workspaceId) {
    throw new Error("users.create() did not return a workspaceId");
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { placement, overlay, clickOutsideClose: true },
  });

  const actionKey = `e2e-open-survey-${createId()}`;
  const actionClass = await prisma.actionClass.create({
    data: { name: actionKey, type: "code", key: actionKey, workspaceId },
    select: { id: true },
  });

  const endings = buildEndings();
  const blocks = transformQuestionsToBlocks(buildQuestions(), endings);

  await prisma.survey.create({
    data: {
      workspaceId,
      createdBy: user.id,
      name: "App survey (non-blocking widget spec)",
      type: "app",
      status: "inProgress",
      displayOption: "respondMultiple",
      delay: 0,
      blocks: blocks as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
      triggers: { create: { actionClassId: actionClass.id } },
    },
    select: { id: true },
  });

  return { workspaceId, actionKey };
};
