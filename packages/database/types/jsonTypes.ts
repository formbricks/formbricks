import { NoCodeConfig } from "@formbricks/types/events";
import { Question } from "@formbricks/types/questions";
import { ThankYouCard } from "@formbricks/types/surveys";
import { NotificationSettings } from "@formbricks/types/users";

declare global {
  namespace PrismaJson {
    export type EventProperties = { [key: string]: string };
    export type EventClassNoCodeConfig = NoCodeConfig;
    export type ResponseData = { [questionId: string]: string };
    export type ResponseMeta = { [key: string]: string };
    export type SurveyQuestions = Question[];
    export type SurveyThankYouCard = ThankYouCard;
    export type UserNotificationSettings = NotificationSettings;
  }
}
