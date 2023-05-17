import { Action } from "../actions";
import { Session, Survey } from "../client";
import { Display } from "../displays";
import { Question } from "../questions";
import { ThankYouCard } from "../surveys";

export interface SurveyResponse {
  id: string;
  questions: Question[];
  thankYouCard: ThankYouCard;
  environmentId: string;
  brandColor: string;
}

export type DisplayResponse = Display;

export type ActionResponse = Action;

export interface SessionResponse {
  session: Session;
  surveys?: Survey[];
  noCodeActions?: any[];
  brandColor?: string;
}
