import { createId } from "@paralleldrive/cuid2";
import { createHash, randomBytes } from "crypto";
import { prisma } from "./packages/database";
import { TSurveyQuestionTypeEnum } from "./packages/types/surveys/types";

const scriptConfig = {
  ORGANIZATION_ID: "cm4r2rp9o0001btgkyl7t8iag",
  API_HOST: "http://localhost:3000",
  API_KEY: "",
  ENVIRONMENT_ID: "",
};

const getResponseTemplate = (surveyId: string, data: Record<string, string>) => {
  return {
    surveyId,
    finished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data,
    language: "default",
  };
};

const responses = [
  "Encountered difficulties in exporting survey data to our preferred formats for analysis.",
  "We use Formbricks to capture leads and appreciate the integrations that allow us to add data to our sheets and register it in our platform efficiently.",
  "The absence of multilingual support limits our ability to survey a diverse user base.",
  "Formbricks was easy to set up and integrate with our existing tools. The wide range of customizable form options and responsive design enhance our user engagement across devices.",
  "We transitioned from Google Forms to Formbricks and have benefited from its enhanced customizability and feature-rich platform, enabling deeper insights into user feedback.",
  "The user interface could be more intuitive; some functionalities are hard to locate.",
  "Encountered issues with survey responsiveness on mobile devices; some elements didn't display correctly.",
  "Formbricks' seamless integration with our tech stack and its emphasis on data privacy have been invaluable. The platform's customizability allows us to tailor surveys to our specific needs.",
  "We encountered CORS errors during survey submissions, hindering data collection.",
  "The generous free tier of Formbricks offers ample room to explore and utilize its features. The clear and detailed documentation facilitates easy implementation across platforms.",
  "Formbricks' no-code approach and full customizability allowed us to match our brand seamlessly. Its compliance with GDPR and CCPA is a significant advantage for our operations.",
  "Formbricks' open-source initiative brings users closer to the software, allowing contributions to its improvement, which is a commendable approach.",
  "We experienced delays in receiving support responses during critical times.",
  "The open-source nature of Formbricks provides flexibility, and its focus on privacy is outstanding. The tools available cater to each stage of user interactions, enhancing our user journey.",
  "Integration with our existing CRM required custom development, as native support was lacking.",
  "The initial setup was challenging due to limited documentation on certain advanced features.",
  "The platform's AI-driven capabilities in categorizing feedback and generating actionable recommendations have streamlined our decision-making process, leading to improved customer satisfaction.",
  "Formbricks' focus on privacy and data security aligns with our organizational values, ensuring that all customer interactions are handled with confidentiality.",
];

const createSurvey = async () => {
  const survey = await prisma.survey.create({
    data: {
      name: `Example Survey ${createId()}`,
      type: "link",
      status: "inProgress",
      questions: [
        {
          id: createId(),
          type: TSurveyQuestionTypeEnum.OpenText,
          headline: { default: "How can we improve Formbricks?" },
          required: true,
          inputType: "text",
          charLimit: { enabled: false },
          subheader: { default: "This is an example survey." },
          placeholder: { default: "Type your answer here..." },
        },
      ],
      environment: {
        connect: {
          id: scriptConfig.ENVIRONMENT_ID,
        },
      },
    },
  });

  return survey;
};

const createResponse = async (surveyId: string, questionId: string, response: string) => {
  const responseResult = await fetch(`${scriptConfig.API_HOST}/api/v1/management/responses`, {
    method: "POST",
    headers: {
      "x-api-key": `${scriptConfig.API_KEY}`,
    },
    body: JSON.stringify(getResponseTemplate(surveyId, { [questionId]: response })),
  });
  return responseResult;
};

const createResponses = async (surveyId: string, questionId: string) => {
  const responsesResult = await Promise.all(
    responses.map((response) => createResponse(surveyId, questionId, response))
  );
  return responsesResult;
};

const createProject = async () => {
  const project = await prisma.project.create({
    data: {
      name: `Test Project ${new Date().toISOString()}`,
      organizationId: scriptConfig.ORGANIZATION_ID,
      config: {
        channel: "link",
        industry: null,
      },
      environments: {
        createMany: {
          data: [
            {
              type: "production",
            },
            {
              type: "development",
            },
          ],
        },
      },
    },
    select: {
      id: true,
      environments: {
        select: {
          id: true,
        },
      },
    },
  });

  return project;
};

const hashApiKey = (key: string): string => createHash("sha256").update(key).digest("hex");

const generateApiKey = () => {
  const key = randomBytes(16).toString("hex");
  return key;
};

const createApiKey = async (environmentId: string) => {
  const key = generateApiKey();
  const hashedKey = hashApiKey(key);
  await prisma.apiKey.create({
    data: {
      environmentId,
      hashedKey,
      label: `AI Test ${createId()}`,
    },
  });
  return { key };
};

export const main = async () => {
  const project = await createProject();
  const environment = project.environments[0];
  const apiKey = await createApiKey(environment.id);

  scriptConfig.API_KEY = apiKey.key;
  scriptConfig.ENVIRONMENT_ID = environment.id;

  const survey = await createSurvey();

  const { id, questions } = survey;

  await createResponses(id, questions[0].id);

  console.log("Survey created and responses added");
};

main();
