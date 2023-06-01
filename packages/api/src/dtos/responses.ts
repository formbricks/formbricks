import { KeyValueData, PersonId, ResponseId, SurveyId } from "../types";

export interface CreateResponseResponse {
  id: ResponseId;
}

export interface UpdateResponseResponse {
  id: ResponseId;
  createdAt: string;
  updatedAt: string;
  finished: boolean;
  surveyId: SurveyId;
  personId: PersonId;
  data: KeyValueData;
  meta: {}; //TODO: figure out what this is
  userAttributes: string[]; //TODO: figure out what this is
  tags: string[]; //TODO: figure out what this is
}

export interface UpdateResponseResponseFormatted
  extends Omit<UpdateResponseResponse, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}
