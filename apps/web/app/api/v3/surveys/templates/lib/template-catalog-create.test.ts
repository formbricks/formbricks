import { createInstance } from "i18next";
import type { TFunction } from "i18next";
import ICU from "i18next-icu";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { ZSurveyCreateInput } from "@formbricks/types/surveys/types";
import { prepareV3SurveyCreate } from "@/app/api/v3/surveys/prepare";
import { ZV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import { templates } from "@/app/lib/templates";
import { replacePresetPlaceholders } from "@/lib/utils/templates";
import enUS from "@/locales/en-US.json";
import { buildV3SurveyCreatePayloadFromTemplate } from "./template-to-v3";

vi.mock("server-only", () => ({}));

/**
 * The trusted template route rebuilds a template server-side and pushes it through the same three
 * gates a hand-written create body goes through. Only the first one reports a usable error: the
 * request schema fails with a 400 naming the field, reference validation with a 422, but
 * `createSurvey`'s own `validateInputs(ZSurveyCreateInput)` throws a bare ValidationError from deep
 * inside the service layer. So a template that trips the last gate only ever surfaced as "An
 * unexpected error occurred." with no indication of which template or which rule (ENG-2578).
 *
 * Walking the whole catalog through all three gates is what catches that before a release: the
 * template bodies are generated from translations, so a rule like "no two choices may share a label"
 * can break for a single template without any code change.
 */
const t = (): TFunction => {
  const instance = createInstance();
  // ICU matches the server's `getTranslate`, so a template string that ICU cannot parse fails here
  // rather than at request time.
  instance.use(ICU).init({
    lng: "en-US",
    fallbackLng: "en-US",
    resources: { "en-US": { translation: enUS } },
    interpolation: { escapeValue: false },
  });
  return instance.getFixedT("en-US");
};

const workspace = { id: "cmnh38nzx00003b6r3svd9pv2", name: "Acme" };

let catalogIds: string[];
let translate: TFunction;

beforeAll(() => {
  translate = t();
  catalogIds = templates(translate).map((template) => template.id);
});

describe("catalog templates are creatable", () => {
  test("the catalog is non-empty", () => {
    expect(catalogIds.length).toBeGreaterThan(0);
  });

  test.each(["link", "app"] as const)("every template passes every create gate as %s", (surveyType) => {
    const rejected: string[] = [];

    for (const template of templates(translate).map((raw) => replacePresetPlaceholders(raw, workspace))) {
      const body = ZV3CreateSurveyBody.safeParse(
        buildV3SurveyCreatePayloadFromTemplate({
          template,
          workspaceId: workspace.id,
          surveyType,
          defaultLanguage: "en-US",
        })
      );

      if (!body.success) {
        rejected.push(`${template.id}: request schema — ${body.error.issues[0]?.message}`);
        continue;
      }

      const prepared = prepareV3SurveyCreate(body.data);
      if (!prepared.ok) {
        rejected.push(`${template.id}: references — ${prepared.validation.invalidParams[0]?.reason}`);
        continue;
      }

      // The shape `executeV3SurveyCreate` hands to `createSurvey`: a template declares no languages,
      // triggers or targeting, so the document fields are the only ones that vary per template.
      const createInput = ZSurveyCreateInput.safeParse({
        name: prepared.document.name,
        type: prepared.document.type,
        status: prepared.document.status,
        metadata: prepared.document.metadata,
        welcomeCard: prepared.document.welcomeCard,
        blocks: prepared.document.blocks,
        endings: prepared.document.endings,
        hiddenFields: prepared.document.hiddenFields,
        variables: prepared.document.variables,
        languages: [],
        questions: [],
        createdBy: "cltwumfbz0000echxysz6ptvq",
      });

      if (!createInput.success) {
        rejected.push(
          `${template.id}: survey document — ${createInput.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; ")}`
        );
      }
    }

    expect(rejected).toEqual([]);
  });
});
