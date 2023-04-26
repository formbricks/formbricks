export interface StartResponseResponse {
  id: string;
}

export interface UpdateResponseResponse {
  id: string;
  createdAt: string;
  updatedAt: string;
  finished: boolean;
  surveyId: string;
  personId: string;
  data: { [key: string]: any };
  meta: {}; //TODO: figure out what this is
  userAttributes: string[]; //TODO: figure out what this is
  tags: string[]; //TODO: figure out what this is
}

export interface UpdateResponseResponseFormatted
  extends Omit<UpdateResponseResponse, "createdAt" | "updatedAt"> {
  createdAt: Date;
  updatedAt: Date;
}
