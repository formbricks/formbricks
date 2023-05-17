import { Question } from "../questions";
import { ThankYouCard } from "../surveys";

export interface SurveyResponse {
  id: string;
  questions: Question[];
  thankYouCard: ThankYouCard;
  environmentId: string;
  brandColor: string;
}
