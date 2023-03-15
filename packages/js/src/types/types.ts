export interface ResponseRequest {
  surveyId: string;
  personId: string;
  response: {
    finished?: boolean;
    data: {
      [name: string]: string | number | string[] | number[] | undefined;
    };
  };
}

export interface Response {
  id: string;
  createdAt: string;
  updatedAt: string;
  organisationId: string;
  formId: string;
  customerId: string;
  data: {
    [name: string]: string | number | string[] | number[] | undefined;
  };
}

export interface Config {
  environmentId: string;
  apiHost: string;
  person?: Person;
  session?: Session;
  surveys?: Survey[];
  noCodeEvents?: any[];
}

export interface Session {
  id: string;
  expiresAt: number;
}

export interface Person {
  id: string;
  userId?: string;
  email?: string;
  attributes?: any;
}

export interface Survey {
  id: string;
  questions: Question[];
  triggers: Trigger[];
}

export type Question = OpenTextQuestion;

export interface OpenTextQuestion {
  id: string;
  type: "openText";
  headline: string;
  subheader?: string;
  placeholder?: string;
  buttonLabel?: string;
  required: boolean;
}

export interface Trigger {
  id: string;
  eventClass: {
    id: string;
    name: string;
  };
}
