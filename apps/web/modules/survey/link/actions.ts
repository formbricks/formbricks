"use server";

import { z } from "zod";
import { resolveSurveyLanguage } from "@formbricks/i18n-utils/survey-language-match";
import { ZLinkSurveyEmailData } from "@formbricks/types/email";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { actionClient } from "@/lib/utils/action-client";
import { getOrganizationIdFromSurveyId } from "@/lib/utils/helper";
import { SINGLE_USE_ID_MAX_LENGTH, SINGLE_USE_TOKEN_MAX_LENGTH } from "@/lib/utils/single-use-surveys";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getOrganizationLogoUrl } from "@/modules/ee/whitelabel/email-customization/lib/organization";
import { sendLinkSurveyToVerifiedEmail } from "@/modules/email";
import { resolveEmailActorUserId } from "@/modules/email/lib/email-actor";
import { getSurveyOwnerId, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { createLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";
import { isLinkSurveyOpenForResponses } from "@/modules/survey/link/lib/public-access";
import { getLinkSurveyCustomCss, omitCustomCssSource } from "@/modules/survey/link/lib/respondent-custom-css";
import type { TSingleUseLinkSurface } from "@/modules/survey/link/lib/single-use-link-metrics";
import { getUnansweredLinkSurveySingleUseAccess } from "@/modules/survey/link/lib/single-use-unanswered";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";

/**
 * Loads the survey behind one of the link page's public gate actions. Both run without a session, so a
 * survey respondents cannot take right now (a draft, archived, non-link, paused, scheduled or completed
 * one) is "not found" here, before anything else is checked, with the same error as an unknown id. The page
 * shows these as a 404 or as their inactive screen, never their definition (ENG-4032).
 *
 * A single-use survey reached without a valid single-use link is "not found" too, the same way: the page
 * shows it only as "this survey can only be taken by invitation" (ENG-4041). So is one reached through a link
 * that has already been answered, which the page shows only as "already answered": a used link stays valid,
 * and would otherwise keep fetching the survey for whoever holds it. `suId` / `suToken` are the link's raw URL
 * values, which the gate screens pass through.
 *
 * What this does not hide: a valid unanswered link costs one more query than a forged link or an unknown id,
 * so the three can still be told apart by latency, as the page and its metadata can. And `/c` also shows
 * "response submitted" for a contact who already answered, which these actions can't mirror: they have no
 * contact to check (the PIN screen holds a contact id, but a client-supplied one can't be trusted, and a
 * caller who wants the definition just leaves it out). That is no extra exposure, since the same PIN opens
 * the survey on `/s/<id>`.
 */
const getSurveyOpenForResponses = async ({
  surveyId,
  suId,
  suToken,
  surface,
}: {
  surveyId: string;
  suId?: string;
  suToken?: string;
  surface: TSingleUseLinkSurface;
}) => {
  const survey = await getSurveyWithMetadata(surveyId);
  if (!isLinkSurveyOpenForResponses(survey)) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  const singleUse = await getUnansweredLinkSurveySingleUseAccess({ survey, suId, suToken, surface });
  if (!singleUse.allowed) {
    throw new ResourceNotFoundError("Survey", surveyId);
  }

  return survey;
};

// The single-use link values arrive from the client and reach a decrypt and a hash, so they are bounded to what
// a link we minted can carry before anything runs on them.
const ZSingleUseLinkParams = {
  suId: z.string().max(SINGLE_USE_ID_MAX_LENGTH).optional(),
  suToken: z.string().max(SINGLE_USE_TOKEN_MAX_LENGTH).optional(),
};

const ZSendLinkSurveyEmailAction = ZLinkSurveyEmailData.extend(ZSingleUseLinkParams);

export const sendLinkSurveyEmailAction = actionClient
  .inputSchema(ZSendLinkSurveyEmailAction)
  .action(async ({ parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.actions.sendLinkSurveyEmail);

    const survey = await getSurveyOpenForResponses({
      surveyId: parsedInput.surveyId,
      suId: parsedInput.suId,
      suToken: parsedInput.suToken,
      surface: "link_email_action",
    });

    if (!survey.isVerifyEmailEnabled) {
      throw new InvalidInputError("EMAIL_VERIFICATION_NOT_ENABLED");
    }

    const [organizationId, surveyOwnerId] = await Promise.all([
      getOrganizationIdFromSurveyId(parsedInput.surveyId),
      getSurveyOwnerId(parsedInput.surveyId),
    ]);
    // Independent reads on the hot path of an unauthenticated action: run them together. `ownerId` stays out
    // of the survey the page loads, which reaches the browser, so it is read here instead.
    const [organizationLogoUrl, actorUserId] = await Promise.all([
      getOrganizationLogoUrl(organizationId),
      resolveEmailActorUserId(surveyOwnerId, organizationId),
    ]);

    // The language arrives from the client, and it ends up as `?lang=` in the link we email out — so
    // resolve it against this survey's own enabled languages here rather than trusting the payload.
    // Anything that names no enabled language becomes "default" and is left out of the link entirely.
    const surveyLanguageCode =
      resolveSurveyLanguage({
        languages: survey.languages,
        explicitLanguage: parsedInput.surveyLanguageCode,
        unmatchedExplicitLanguage: "fallback",
      }) ?? "default";

    // The name and logo come from the stored survey and its organization, never the request: a caller
    // could otherwise put text of their choosing into an email sent from this instance (ENG-4043). The
    // single-use link values ride along only for a survey that uses them, where the gate above checked them.
    const isSingleUse = survey.singleUse?.enabled === true;
    await sendLinkSurveyToVerifiedEmail(
      {
        ...parsedInput,
        suId: isSingleUse ? parsedInput.suId : undefined,
        suToken: isSingleUse ? parsedInput.suToken : undefined,
        surveyLanguageCode,
        surveyName: survey.name,
        logoUrl: organizationLogoUrl || "",
      },
      // The visitor is anonymous, so the survey's organization and owner carry the limits: a fresh
      // survey or organization does not reset them.
      {
        organizationId,
        actorUserId,
        externalRecipient: true,
      }
    );
    return { success: true };
  });

const ZValidateSurveyPinAction = z.object({
  surveyId: z.cuid2(),
  pin: z.string(),
  // The single-use link the PIN screen was opened with, as it appears in the URL.
  ...ZSingleUseLinkParams,
});

export const validateSurveyPinAction = actionClient
  .inputSchema(ZValidateSurveyPinAction)
  .action(async ({ parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.actions.validateSurveyPin);

    // Gated before the PIN comparison, so a survey that is not public, or a single-use survey reached without
    // its link, can't be probed for its PIN either.
    const survey = await getSurveyOpenForResponses({
      surveyId: parsedInput.surveyId,
      suId: parsedInput.suId,
      suToken: parsedInput.suToken,
      surface: "link_pin_action",
    });

    const surveyPin = survey.pin;
    const originalPin = surveyPin?.toString();

    if (originalPin && originalPin !== parsedInput.pin) {
      throw new InvalidInputError("INVALID_PIN");
    }

    // The survey goes to the respondent's browser: without its stored custom CSS (editable source),
    // with the compiled CSS the link page would otherwise have rendered (ENG-3552). Resolved only after
    // the PIN matched, so a PIN-protected survey's CSS is not readable before it is unlocked.
    const workspaceContext = await getWorkspaceContextForLinkSurvey(survey.workspaceId);
    const customCss = await getLinkSurveyCustomCss({
      workspaceCustomCss: workspaceContext.customCss,
      allowStyleOverwrite: workspaceContext.workspace.styling?.allowStyleOverwrite,
      survey,
    });
    // Without the PIN, like the survey the renderer hands out: the respondent just typed it, but the two
    // paths should never disagree about what leaves the server.
    const publicSurvey = { ...omitCustomCssSource(survey), pin: null };

    if (!originalPin) return { survey: publicSurvey, customCss };
    return { survey: publicSurvey, customCss, pinAuthToken: createLinkSurveyPinToken(survey.id) };
  });
