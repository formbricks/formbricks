/* eslint-disable @typescript-eslint/no-unnecessary-condition -- field.placeholder can be undefined for surveys created before this migration */
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

interface Field {
  show: boolean;
  required: boolean;
  placeholder: Record<string, string>;
}

interface ContactInfoQuestion {
  type: "contactInfo";
  firstName: Field;
  lastName: Field;
  email: Field;
  phone: Field;
  company: Field;
}

interface AddressQuestion {
  type: "address";
  addressLine1: Field;
  addressLine2: Field;
  city: Field;
  state: Field;
  zip: Field;
  country: Field;
}

type Question = ContactInfoQuestion | AddressQuestion;

interface Survey {
  id: string;
  questions: Question[];
  languages: {
    default: boolean | null;
    language: {
      code: string | null;
    };
  }[];
}

/** The survey's language codes, the default one as "default"; just "default" without any. */
const getLanguageCodes = (survey: Survey): string[] => {
  const languagesCodes = survey.languages.length
    ? survey.languages
        .filter((lang) => lang.language.code !== null)
        .map((language) => {
          if (language.default) {
            return "default";
          }
          return language.language.code ?? "default";
        })
    : ["default"];

  if (languagesCodes.length === 0) {
    languagesCodes.push("default");
  }
  return languagesCodes;
};

/** The same placeholder text in every language. */
const placeholderFor = (languagesCodes: string[], text: string): Record<string, string> =>
  languagesCodes.reduce(
    (acc, code) => ({
      ...acc,
      [code]: text,
    }),
    {}
  );

/** Fills the placeholders of a contact info or address question that has none; true when it did. */
const addMissingPlaceholders = (question: Question, languagesCodes: string[]): boolean => {
  if (question.type === "contactInfo") {
    if (question.firstName.placeholder) {
      return false;
    }
    const { firstName, lastName, email, phone, company } = question;
    firstName.placeholder = placeholderFor(languagesCodes, "First Name");
    lastName.placeholder = placeholderFor(languagesCodes, "Last Name");
    email.placeholder = placeholderFor(languagesCodes, "Email");
    phone.placeholder = placeholderFor(languagesCodes, "Phone");
    company.placeholder = placeholderFor(languagesCodes, "Company");
    return true;
  }
  if (question.type === "address") {
    if (question.addressLine1.placeholder) {
      return false;
    }
    const { addressLine1, addressLine2, city, state, zip, country } = question;
    addressLine1.placeholder = placeholderFor(languagesCodes, "Address Line 1");
    addressLine2.placeholder = placeholderFor(languagesCodes, "Address Line 2");
    city.placeholder = placeholderFor(languagesCodes, "City");
    state.placeholder = placeholderFor(languagesCodes, "State");
    zip.placeholder = placeholderFor(languagesCodes, "Zip");
    country.placeholder = placeholderFor(languagesCodes, "Country");
    return true;
  }
  return false;
};

export const addPlaceholderToContactAndAddressQuestion: MigrationScript = {
  type: "data",
  id: "ico21lgyp1o8x8h6fyvsdlwp",
  name: "20250103060634_add_placeholder_to_contact_and_address_question",
  run: async ({ tx }) => {
    const surveys = await tx.$queryRaw<Survey[]>`
      SELECT 
        s.id,
        s.questions,
        json_agg(
          json_build_object(
            'default', sl."default",
            'language', json_build_object(
              'code', l.code
            )
          )
        ) as languages
      FROM "Survey" s
      LEFT JOIN "SurveyLanguage" sl ON s.id = sl."surveyId"
      LEFT JOIN "Language" l ON sl."languageId" = l.id
      GROUP BY s.id, s.questions
    `;

    if (surveys.length === 0) {
      logger.info("No surveys found");
      return;
    }
    let surveyUpdateCount = 0;
    const updatePromises: Promise<unknown>[] = [];

    for (const survey of surveys) {
      let shouldUpdate = false;
      const questionsCopy = [...survey.questions];
      const languagesCodes = getLanguageCodes(survey);

      for (const question of questionsCopy) {
        if (addMissingPlaceholders(question, languagesCodes)) shouldUpdate = true;
      }

      if (shouldUpdate) {
        surveyUpdateCount++;
        updatePromises.push(
          tx.$queryRaw`
            UPDATE "Survey" 
            SET questions = ${JSON.stringify(questionsCopy)}::jsonb 
            WHERE id = ${survey.id}
          `
        );
      }
    }

    await Promise.all(updatePromises);
    logger.info(`Updated ${surveyUpdateCount.toString()} surveys`);
  },
};
